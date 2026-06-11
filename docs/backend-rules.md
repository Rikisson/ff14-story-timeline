# Backend rules

Where the bits go and what the bill looks like — data layer, binary storage, realtime, search, cost. Entity shape lives in `narrative-engine-impl.md`; asset shape in `media-rules.md`.

---

# Rules

## Stack

- **Data**: Cloud Firestore. Per-universe collections under `universes/{u}/...` (see `narrative-engine-impl.md` *Story persistence* for the metadata-vs-content split, the only exception to "flat doc per entity").
- **Auth**: Firebase Auth.
- **Binary assets**: Cloudflare R2. Firebase Storage is not used.
- **Search**: separate service when full-text search ships. Firestore is not the search index.
- **Compute**: client-side; no Cloud Functions in v1. Server-side derivations are denormalized into Firestore docs.

Posture is "Firebase for now, schema portable to Postgres later." A migration to Supabase or comparable is not planned, but stays cheap to perform if the catalog outgrows what Firestore queries comfortably serve.

## User accounts

A single `users/{uid}` doc per authenticated user, bootstrapped on first sign-in via `UserDocService.bootstrap()` — an idempotent transactional create-if-missing, fire-and-forget from `AuthStore.onInit`.

Doc shape: `{ staffRole?: 'admin', authoredUniverseCount: number, createdAt: number, updatedAt?: number }`.

- `staffRole`, when present, bypasses the universe-authorship cap and enables admin-only operations: reading soft-deleted universes, hard-deleting after soft-delete, and writing `staffRole` on any user doc.
- `authoredUniverseCount` is the count of live universes where `authorUid == uid` and `deletedAt == null`. The universe-create and universe-soft-delete transactions maintain it. Capped at 2 for non-admins.
- `createdAt` is set at first bootstrap; `updatedAt` mirrors the last counter mutation.

On the write side, `MediaAssetsService.upload` / `MediaAssetsService.delete` commit asset writes via `runTransaction`: the `_assets/{assetId}` doc and the host universe's `storageBytes` / `assetCount` counters move in one atomic step. `UniverseImportService.uploadAssets` follows the same pattern per imported asset.

Counter integrity is **advisory, not a security boundary**. Rules bound `authoredUniverseCount` to `[0, 2]` for non-admin self-writes and lock `staffRole` to admin-only writes, but Firestore rules cannot enforce cross-document atomicity between `users/{uid}` and `universes/{u}` writes inside a single transaction. A determined authenticated user could manipulate their own counter. The friends-and-family mitigation is layered: per-universe 500 MB storage ceiling enforced at the Worker, a reconciliation script that recomputes counters from canonical universe rows, and a Cloud Billing budget alert. Strict enforcement post-launch routes counter writes through a server-side Cloud Function or Worker holding admin credentials.

Naming: `authoredUniverseCount` is unambiguous about what it counts. Future concepts like a personal library of read-only purchased universes get their own field (e.g. `libraryUniverseIds`) and never share semantic space.

## Portability posture

- **Flat documents per entity.** The Story metadata/content split is the only exception, and it ports 1:1 to a relation in Postgres.
- **`EntityRef` is opaque to consumers.** Domain code reads `{ kind, id }`; resolution goes through services that can be swapped behind the same shape.
- **No Firestore types in the domain layer.** `Timestamp`, `FieldValue`, `DocumentReference` and friends live in `*.service.ts` only. Domain models use `Date` (or `number` for in-game time) and `string` IDs.
- **Path structure maps to a foreign key.** `universes/{u}/{kind}/{id}` ports to `(universe_id, id)`; `universes/{u}/_meta/*` ports to per-universe config tables.

## Binary storage

- **Cloudflare R2, never Firebase Storage.** Egress is the dominant cost on a media-rich reader; R2 doesn't charge for it. Per-scene background and audio preload (see `narrative-engine-impl.md` *Scene rendering layers*) multiplies a per-GB egress bill across assets readers may never view.
- **The asset doc's `url` field abstracts the backend** (see `media-rules.md` *Schema*). Entities reference asset IDs; the asset doc holds the public R2 URL. Swapping storage backends never reaches entity code.
- `cacheControl: 'public, max-age=31536000'` (already required in `media-rules.md`) works directly with R2's edge caching.
- **Public-by-default for now.** If per-universe private buckets ever become a requirement, a thin Cloudflare Worker in front of R2 signs URLs against Firebase Auth tokens; the asset doc URL points at the Worker rather than R2 directly. Entity code still doesn't change.

## Query architecture

Canonical entity docs at `universes/{u}/{kind}/{id}` are the source of truth. Two projection types serve query workloads; neither is authoritative, and either can be regenerated from canonical docs.

### Directory projection

`universes/{u}/_directory/{kind}_{id}` — one row per entity, all kinds in one collection. Carries enough metadata to find, filter, and chip-render an entity without reading the canonical doc:

`{ kind, entityId, label, labelFolded, slug, coverAssetId?, secondary?, categoryKey?, status?, visiblePublic, draft?, sourceFingerprint, updatedAt }`

Powers related-ref pickers, inline-ref suggestions, plotline filter selectors, resolver chips, and generic "find entity" UI. Prefix search uses `labelFolded` with `startAt(q) / endAt(q + '\uf8ff')` (high-codepoint sentinel), capped at 20 results.

`visiblePublic` is a projection-only field, computed by the projection writer as `canonical.draft !== true`. Canonical docs carry `draft` (where the kind has it) and nothing visibility-derived — keeping the visibility flag out of the domain layer preserves the *Portability posture* rule about query-shape fields. The predicate works uniformly: kinds without draft state (every kind except Story today) have `canonical.draft === undefined` and satisfy `draft !== true`, so `visiblePublic` is `true`; Story rows get `true` when `draft === false` and `false` when `draft === true`. A non-story kind that gains `draft` later picks up the same derivation automatically — the projection schema does not change.

The per-kind `secondary` line follows the rules in `narrative-engine-impl.md` *Scope locks* — the projection writer is responsible for computing it at write time so consumers never have to resolve cross-entity refs to render a list row.

### Timeline projections

`universes/{u}/_timelineEntries/{kind}_{id}` — the mixed story+event date stream. Each row carries `title, coverAssetId, inGameDate, dateSortKey, dateKnown, characterIds[], placeIds[], draft, visiblePublic, sourceFingerprint, updatedAt`.

The projection interleaves stories and events by date — do not fetch them separately and stitch client-side. Explore reads the single `_timelineEntries` stream and refines type / title client-side over the loaded page (see `narrative-engine-impl.md` *Explore UX*). Plotline filtering is not a constraint on this stream: a selected plotline switches the data source to that plotline's `members[]`, fetching each member's row by id. Rows carry no `plotlineIds` — arc membership lives on the plotline (see `narrative-engine-impl.md` *Scope locks*), so there is no array-contains index here.

`dateDisplay` is not stored. The client formats from `inGameDate` through `formatInGameDate` (see `narrative-engine-impl.md` *Calendar*) so a calendar config edit doesn't require a content rewrite.

### Asset references

Projections store `coverAssetId` only; URLs live on `_assets/{assetId}`. List and timeline rendering resolves visible asset IDs lazily through a shared `AssetThumbResolver` that batches `in` queries (Firestore caps `in` at 30), caches by `(universeId, assetId)` for the session, and falls back from `thumbUrl` to `url` for assets uploaded before the thumb pipeline. Loading a universe must never preload the entire `_assets` collection for a public list, timeline, or picker surface.

### Inline-ref resolution

A scene with N `${kind:guid}` tokens hydrates through a shared `EntityResolverCache` that collects unknown IDs across the body and issues batched `in` reads (max 30 per chunk). The cache is session-scoped and keyed by `(universeId, kind, id)`. Per-token `getDoc` is the anti-pattern.

### No partial-array indexes

A picker, search input, inline-ref resolver, or timeline view that needs to *find* entities reads through directory or timeline projections via a query-scoped store. The first-page cache that a per-kind list service happens to hold is not an index; `.find()` over it misses everything past the first page and is a correctness bug, not a perf concern.

### Folded keys

`labelFolded` and `titleFolded` use a single shared normalizer: NFKD form, lowercased, diacritics stripped. Every writer of a projection row routes through the same util — divergent folding misses prefix queries silently.

### Date sort keys

`dateSortKey` is produced by a single shared util `inGameDateSortKey(date, calendarConfig)` returning a fixed-width lexically-sortable string. The same util backs `compareInGameDate` in `@shared/utils`, so client-side ordering and Firestore `orderBy('dateSortKey')` never diverge. Partial dates encode missing components as zero-prefixed sentinels: a year-only event sorts before any month-precise event in the same year; an era-only event sorts before any year in the era. Calendar config changes (era reorder, month reorder, era `maxYears` edit) invalidate every sort key and trigger a universe-scope projection rebuild — see *Write discipline*.

### Drift detection

Each projection row carries `sourceFingerprint` — a short stable hash of the row's projected fields, computed at write time. Drift detection works by recomputing the fingerprint from the current canonical doc's projected slice and comparing: equal means current, unequal means a rebuild is due.

This decouples drift from canonical versioning. Story increments `version` on every save (metadata or content per `narrative-engine-impl.md` *Story persistence*); a content-only edit doesn't change any projected field, so the projection row's `sourceFingerprint` stays valid and a drift detector won't flag it. The fingerprint also covers unversioned kinds without special-casing — only the projected slice matters.

Fingerprint computation is deterministic — every writer and the rebuild script must produce the same hash for the same projected slice or the whole mechanism degrades into spurious-rebuild noise. The shared util enforces: object keys serialized in sorted order; string fields trimmed and Unicode-normalized (NFC); reference-ID arrays (`characterIds`, `placeIds`, the resolver-side `relatedRefs` IDs) sorted ascending; absent vs. empty-array vs. explicit-null collapsed to a single canonical form. Sequences whose order is semantically meaningful (none in current projections — scenes aren't projected) preserve order. Hash algorithm is implementation-defined; a short SHA-256 prefix (12 hex chars) is sufficient at the per-universe row counts we expect.

Drift sources: writer bugs, schema migrations, and out-of-band console edits. Firestore `runTransaction` atomicity rules out partial-write failure within a single entity save as a drift source.

### Cardinality limits

Projection fan-out has to be bounded or a single write balloons into hundreds of projection rows and a single timeline render fires hundreds of queries. v1 caps, enforced in forms with clear validation copy:

- **`Plotline.members`: 100.** Membership lives in the one plotline doc as an ordered array, so the cap keeps it well under Firestore's 1 MB doc ceiling while staying generous for a curated arc. A reorder or add/remove is a single-doc write; `memberKeys` is re-derived in the same write. If a plotline ever needs more, migrate `members` to a sub-collection at that point — not pre-emptively.
- **`relatedRefs` per entity: 50.** Bounds inline-ref hydration size on detail pages; for Story / Event the cap also caps `characterIds[]` / `placeIds[]` array length on timeline projection rows. For Character / Place / Codex, `relatedRefs` doesn't fan out to projections, so the cap is a UX / cost ceiling rather than a fan-out one.
- **Inline-ref batch hydration per render pass: 30.** Matches Firestore's `in` chunk cap; the resolver chunks larger payloads transparently.
- **`Character.sprites`: 32.** Bounds the sprite picker and per-character asset payload at scene render. Enforced in rules on every character write.
- **`Place.backgrounds`: 32.** Same rationale for place backgrounds; same rule enforcement.
- **`Place.ambientAudio`: 24.** Bounds preload payload on scene mount. Same rule enforcement.

### Cache invalidation

Client-side caches don't auto-invalidate on write. The entity-write helper publishes invalidation events that every session-scoped cache subscribes to:

- **Entity write** invalidates `EntityResolverCache` entries keyed by `(universeId, kind, id)` so the next inline-ref render fetches the new label.
- **Entity write** dirties matching rows in any active query store (directory, timeline); the store either patches the row in place from the freshly-written projection or refetches the current page.
- **Asset write / delete** invalidates `AssetThumbResolver` entries keyed by `(universeId, assetId)`. Asset URLs are immutable per asset ID, so this only matters for asset deletes and metadata edits — but the listener is the same shape.

Without these hooks, editor surfaces show stale names / chips / thumbnails after save until the page reloads.

### Public read surface

Public list, filter, picker, and timeline queries route through `_directory` and `_timelineEntries` and rely on `visiblePublic` for visibility — one rule shape (`allow read: if resource.data.visiblePublic == true || isMember(...)`) covers every kind uniformly. Canonical collections serve detail-by-ID reads, gated per-kind. When a non-story kind gains `draft` later, its canonical-read rule gains the same `draft == false || isMember(...)` clause Story carries today; the projection-read rule never changes.

**Firestore rules do not auto-filter query results — they gate each returned doc and reject the whole query if any returned doc fails.** Public callers must include `where('visiblePublic', '==', true)` in every projection query; the rule alone is not a filter. A query that omits the predicate may work for members (`isMember` short-circuits the gate) and fail for guests as soon as one draft row falls into the result page.

### Connections

`universes/{u}/connections/{id}` stores the typed `continues` edges between stories and events (model semantics in `narrative-engine-impl.md` *Connections*). The collection is canonical and queried directly — no projection rows, no `connectionCount` denorms, no listeners.

- **Deterministic doc IDs** (`story_{storyId}_{sceneId}` / `event_{eventId}`) make the one-outbound-per-endpoint cap structural — the only race-free client-side enforcement, since the web SDK cannot query inside transactions.
- **Queries are equality-only** on the denormalized `fromEntityKey` / `toEntityKey` strings (`'{kind}:{id}'`, re-derived on every write), optionally plus `visibility` — served by single-field auto-indexes with zig-zag merge; no composite-index entries until an `orderBy` appears.
- **Rule shape** follows the public-read pattern with `visibility` as the inline data condition: `allow read: if (isUniverseActive(u) && resource.data.visibility == 'reader') || isMember(u) || isAdmin()`; writes are member-only. Guest list queries must include `where('visibility', '==', 'reader')` per the pre-check rule above.
- **Reads are one-shot + session-cached.** `ConnectionsService` caches reader-visibility queries per `(universe, direction, entity)` and invalidates on every connection write. Editor reads are always fresh.
- **Entity deletion cascades outbound only.** `StoriesService.deleteStory` and `EventsService.remove` best-effort delete the entity's outbound connections after the canonical delete transaction commits (a `writeBatch` over a `fromEntityKey` query). Inbound connections belong to other entities' authors and are left to surface as broken edges with editor fix actions — a failed cascade is covered by the same handling.

### Plotline membership

`Plotline.members` (ordered `EntityRef<'story' | 'event'>[]`) is the authored source of truth; `memberKeys: string[]` (`'{kind}:{id}'`) is re-derived from it on every write for the reverse lookup. Both are canonical-only — never projected, never serialized to the `.universe` archive (the archive ships `members`; `memberKeys` is rebuilt on import).

- **Writes are single-doc.** `PlotlinesService.setMembers` patches `members` + `memberKeys` together via the non-projected `patchFields` path. Adding, removing, or reordering a member touches only the plotline doc — no fan-out into member entities, no projection rebuild.
- **Two read paths, both on the existing `plotlines/{id}` rule** (`isUniverseActive || isMember || isAdmin`): Explore reads a plotline doc by id to drive its member-filtered view (public on active universes); the editor runs `where('memberKeys', 'array-contains', '{kind}:{id}')` to show an entity's read-only membership chips. The `array-contains` field is auto-indexed, and the rule's `isUniverseActive` clause is `resource.data`-independent so the query passes the list pre-check.
- **Dangling members are tolerated, not cascaded.** Deleting a story/event does not scrub plotlines that list it; readers skip members whose row no longer resolves and the plotline editor flags them — the same passive policy as broken connections.

### Write discipline

Entity create / update / delete uses `runTransaction`, not `writeBatch` — slug claim (read-then-write against `_slugIndex`) and OCC version checks both require the transaction's read-before-write semantics; `writeBatch` is write-only and cannot enforce either. A single transaction writes:

- canonical doc
- `_directory/{kind}_{id}`
- `_timelineEntries/{kind}_{id}` for story / event only
- the relevant `_slugIndex/{kind}_{slug}` entries (see *Atomic slug uniqueness* in Implementation)

Projection writes fire on canonical metadata-doc writes only — Story scene/content edits at `_content/main` never touch projections. Writers compare the new projected slice's `sourceFingerprint` against the existing row's and skip the projection legs of the transaction when the fingerprint matches; a cover swap or rename pays the fanout, a body edit doesn't.

The shared write helper factors into a composable transaction-body primitive (`applyEntityWrite(tx, ...)` / `applyEntityDelete(tx, ...)`) plus thin `runTransaction` wrappers for kinds with no per-kind logic. Story composes the primitive inside its own `runTransaction` to combine the metadata write, the `_content/main` write, and the OCC version check with the projection fan-out — all atomic. Because Firestore requires every `tx.get` to precede every `tx.set` / `tx.delete`, callers composing the primitive must do their own reads (OCC version check, custom validation) before the `applyEntityWrite` call returns. The primitive itself reads canonical, the existing directory row, and the new slug-claim doc up front, then writes.

Three lifecycle transitions invalidate projection rows beyond the canonical edit. v1 has no Cloud Functions; every rebuild is a client-side action initiated by the settings UI that performed the triggering change, with visible progress and chunked writes:

- **Publish / unpublish** flips `visiblePublic` across every projection row for that entity. Single-entity scope; fits in one `runTransaction` alongside the canonical write.
- **Calendar config change** invalidates `dateSortKey` for every story and event in the universe. The calendar settings save blocks behind a progress modal until the universe-scope rebuild completes — stale sort keys would scramble the timeline silently, so the save isn't done until the rebuild is.
- **Category rename** triggers a scoped rebuild of every codex directory row whose `categoryKey` matches the renamed category. The settings UI shows a toast with progress; rows refresh in place as the rebuild advances. The rebuild path — chunked into `writeBatch` commits of ≤500 ops, idempotent on retry because each row's `sourceFingerprint` is derived from its current canonical projected slice, not from prior projection state — handles arbitrary fanout. A single `runTransaction` can't, because Firestore caps transactions at 500 ops and a popular category may have many more entries. `id` and `key` are stable, so canonical codex entry docs aren't touched.
- **Category delete** is blocked until every codex entry referencing it has been reassigned or removed; the settings UI surfaces the affected entry count and a reassign-or-remove flow before the delete is allowed to proceed.

## Soft-delete & cleanup

`universes/{u}.deletedAt: number | null` is always present. `null` means the universe is active; a unix-ms timestamp means it has been soft-deleted and is pending cascade.

Lifecycle:

1. **Soft-delete.** `UniversesService.softDelete` runs a transaction that sets `deletedAt = now` on the universe and decrements the author's `users/{uid}.authoredUniverseCount`. The authorship-cap slot is freed at this moment, not at hard-delete, so a soft-delete immediately makes room for a fresh universe.
2. **Cascade.** A client-side walker (`UniverseDeletionService`) lists and deletes every subcollection, every `_assets` doc, and every R2 object the universe owns. The walk is idempotent and can resume from partial state after a refresh.
3. **Hard-delete.** The final step removes the universe doc itself. The rule layer enforces `deletedAt != null` as a precondition, so a hard-delete cannot bypass the soft step.

Rules track this lifecycle via two helpers:

- `isUniverseActive(universeId)` — `deletedAt == null`.
- `isPendingCleanup(universeId)` — `deletedAt != null`.

Active universes accept the full member CRUD surface. Soft-deleted universes accept **delete only** on subcollection docs (the cleanup permission), reject create / update on subcollections, and disappear from public reads at the universe doc level. Members and admins can still read the universe doc and its subcollections to drive a resume-cleanup UI.

Soft-delete is permanent — no undo. Restoration is via `.universe` archive import or a fresh create.

## Realtime listeners

`onSnapshot` is opt-in, not the default.

- **Use a listener** for editor auto-save / conflict resolution and player-side cloud-sync slots — both have a clear "another writer may change this while I have it open" story.
- **Do not use a listener** for catalog browsing, public detail pages, timeline rendering, picker results, or any read-only consumer surface. A one-shot `getDocs` + session cache is correct.
- Listener charges include rule re-evaluation on reconnect and on rule deploys; on public collections they multiply by audience size.

## Pagination and filtering

Reads target the projection collections from *Query architecture* above; canonical docs serve detail and edit, not list.

- **Cursor-based only** (`startAfter` / `endBefore`). No arbitrary page-N skips — Firestore can't, and "View more" is the consumer surface anyway.
- **Every filter combination a UI exercises requires a composite index**, enumerated in `firestore.indexes.json`. Ad-hoc client-side filtering after a loose query is not the answer.
- **Total-count badges use `count()` aggregation** — one read per invocation, not one per matched doc — and are cached client-side for the session.
- **`array-contains-any` caps at 10 values.** Tag filtering UIs enforce this at the picker; over-10 selections fan out into multiple queries client-side, or are rejected with a clear message.

## Search

- **Directory prefix search is the v0 backend.** `_directory` with `labelFolded` ordering and `startAt / endAt` bounds covers exact-prefix lookups across all kinds and is enough for picker and inline-ref hydration. Substring, fuzzy, and field-boost search are out of scope at this tier.
- **When full-text search ships, it lives behind `EntitySearchService`.** The same interface the directory adapter implements; swapping in Typesense (self-hosted on a small VPS), Meilisearch (similar profile), or Algolia (only if budget tolerates the price) is an adapter swap, not a caller rewrite.
- **Sync via a write-side hook on entity save.** The search index is authoritative for *finding*; Firestore remains authoritative for the entity itself. Stale indexes are a recoverable bug; stale entities are not.
- **Search results are ID lists.** Entity hydration goes back through the normal Firestore service so security rules and field shape apply uniformly to search-found and browse-found entities alike.

## Cost canaries

Three signals to watch as the app grows; each maps to a specific mitigation, none requires a platform switch:

| Canary                                | Mitigation                                                                                  |
|---------------------------------------|---------------------------------------------------------------------------------------------|
| Catalog reads dominate the bill       | Edge-cache catalog responses (Cloudflare Worker in front of a batched `/catalog` endpoint)  |
| Composite-index storage growth        | Audit `firestore.indexes.json`; drop combos no UI actually uses                             |
| Search-service operational cost       | Self-host Typesense before reaching for Algolia                                             |

Media egress is the non-canary — mitigated structurally by R2; should not appear on a cost report.

### Worker rate limit

The `media-signer` Worker rate-limits every authenticated route at **30 requests/minute/UID** via a KV namespace binding (`MEDIA_RATE_LIMIT`). The window is a fixed minute bucket — `rate:{uid}:{minute}` — incremented on each request, TTL'd to 120s. Over-cap requests return `429`.

The limiter is sloppy under high concurrency (KV lacks atomic increment); two near-simultaneous reads may both write `count + 1` from the same value. Acceptable for F&F-stage — the cap is a canary against signing-loop abuse, not a security boundary. The hard ceiling stays the Cloud Billing budget alert.

`POST /bulk-delete` counts as exactly one request regardless of how many keys it carries (≤ 50), so the cascade walker doesn't hit the limiter during a single soft-delete cleanup.

## Pricing model awareness

Firestore bills per operation; spikes are uncapped by default.

- **Reads scale with audience × catalog size; writes scale with authoring activity.** The first dominates if the app gets shared publicly; the second if a power user authors heavily. Mitigations differ (CDN cache vs. batched writes) — attribute spend before reacting.
- **A budget alert is mandatory before public launch.** The cap is informational, not enforced; the alert catches a runaway loop before the invoice does.
- **The Firebase Web API key isn't a secret** — it identifies the project — but domain restriction blocks casual abuse from other origins.

---

# Implementation

## Cost guardrails

- Cloud Billing budget alert per environment, set to a number you don't want to silently pass.
- Firestore Usage tab dashboard bookmarked; reads, writes, and storage reviewed weekly during early launch.
- Restrict the Firebase API key to the GitHub Pages domain (Cloud Console).

## Seed schema

The seeder at `src/mocks/seeder.service.ts` is the source of truth for a fresh database. It must write every collection the new code reads:

- canonical entity docs with the new field shapes (`categoryKey` not `category`, `version` where the kind uses OCC)
- `_meta/codex_categories` with `{ id, key, label, color?, description?, version }`
- `_meta/calendar` (no version)
- `_slugIndex/{kind}_{slug}` for every seeded entity
- `_directory/{kind}_{id}` rows with computed `labelFolded`, `secondary`, `visiblePublic`, `sourceFingerprint`, `updatedAt`
- `_timelineEntries/{kind}_{id}` for stories and events

Production-side rebuild for ongoing recovery (out-of-band edits, calendar / category lifecycle triggers) lives in *Projection writers and rebuild*; the seeder doesn't share that code path because it runs against an empty DB and doesn't need the diff-against-existing logic.

## Atomic slug uniqueness

The current check reads-then-writes across `UniverseEntityService.assertSlugAvailable` and `UniversesService.findBySlug`; concurrent writers can both pass. Replace with a denormalized index doc at `universes/{id}/_slugIndex/{kind}_{slug}` claimed inside the entity-write `runTransaction` (see *Write discipline* in Rules). Full lifecycle, all inside the same transaction as the canonical and projection writes:

- **Create:** transaction reads `_slugIndex/{kind}_{slug}`. If it exists with `entityId` belonging to another entity, throw a typed `SlugTakenError`. Otherwise `set` the slug doc with the new entity's id.
- **Rename (slug change on existing entity):** transaction reads the new slug doc. If owned by another entity, throw. Otherwise `delete` the old `_slugIndex/{kind}_{oldSlug}` and `set` the new one.
- **Delete:** transaction `delete`s `_slugIndex/{kind}_{slug}` alongside the canonical entity doc.
- **Idempotent no-op:** an update that leaves the slug unchanged claims the same doc to itself (already owned) and writes nothing new.

Route every slug check through the same helper so no service path can skip the claim.

## Firestore indexes manifest

`firestore.indexes.json` doesn't exist yet; create it and wire it through `firebase.json`. Add composite indexes as the UI exercises each combination — don't pre-author combos no picker, list, or timeline view actually runs.

Day-one combinations:

- `_directory`: `(visiblePublic, kind, labelFolded)` for the public per-kind picker (the most-used query), `(visiblePublic, labelFolded)` for cross-kind inline-ref search, `(kind, labelFolded)` for member-only authoring pickers that need draft entities
- `_timelineEntries`: `(visiblePublic, dateKnown, dateSortKey ASC)` and `(visiblePublic, dateKnown, dateSortKey DESC)` for public reads; `(dateKnown, dateSortKey ASC)` and `(dateKnown, dateSortKey DESC)` for the member timeline that includes drafts and so drops the `visiblePublic` clause. The page offers both newest-first and oldest-first sorting; Firestore composite indexes are direction-specific so both variants must be authored for each scope
- `codexEntries`: `(categoryKey, titleFolded)`

The plotline reverse lookup (`plotlines where memberKeys array-contains '{kind}:{id}'`) needs no composite entry — `array-contains` on a single field is auto-indexed. Character / place timeline filter indexes wait until the timeline UI offers those filters.

## Firestore rules for projections

`_directory`, `_timelineEntries`, and `_slugIndex` are new collections with no rules yet. The shape for every projection collection follows the *Public read surface* rule:

```
match /universes/{universeId}/_directory/{rowId} {
  allow read: if resource.data.visiblePublic == true || isMember(universeId);
  allow create, update, delete: if isMember(universeId);
}
```

Same pattern for `_timelineEntries`. The retired `_timelineLaneEntries` collection keeps a read/delete-only rule so legacy rows in older universes can still be swept and purged. `_slugIndex` is member-only on both read and write — it has no public consumer because slug lookups happen by exact doc ID, never by query, so a public read rule would only enable enumeration without enabling any feature.

## Projection writers and rebuild

Row construction lives in a pure `buildProjectionRows({ kind, id, slug, directory, timeline? }, updatedAt)` builder that the live write path, the in-app rebuild service, and the CLI ops script all call. Each kind exposes its own pure per-kind input builder (`buildCharacterDirectoryInputs`, `buildEventTimelineInputs`, …) so cross-feature dependencies (Calendar config, Codex categories) flow in as plain context objects rather than Angular injections. The entity services become thin DI wrappers; the rebuild paths never duplicate per-kind logic.

Rebuild has two forms:

- **In-app `ProjectionRebuildService`** — `rebuildForCalendarChange(universeId)`, `rebuildForCategoryRename(universeId, categoryKey)`, and `rebuildKind(universeId, kind)`. Exposes a `Signal<RebuildProgress>` (phase / processed / total / currentKind) so the calendar settings save flow can block behind a progress modal and the categories settings rename flow can drive a toast. Each row write publishes an `entity-write` event on the cache-invalidation bus so resolver caches refresh in place.
- **CLI `scripts/rebuild-projections.mjs`** — plain Node ESM, signs in via Firebase Auth (member of the target universe) and walks the same kinds. Used for deploy-time recovery and out-of-band-edit cleanup. The CLI inlines a port of the pure builders because it runs without a TS transpiler; a header comment in the script points at the TS source as the spec.

Both forms recompute `sourceFingerprint` from canonical projected fields and mirror `canonical.updatedAt` onto every projection row, so rebuilt rows aren't immediately flagged as stale by drift detectors. Both forms chunk writes via `writeBatch` (≤450 ops to leave headroom under the 500-op cap).

Both forms run an orphan-sweep pass per kind after the canonical walk: rows in `_directory` / `_timelineEntries` / `_slugIndex` whose `entityId` no longer matches any canonical doc are deleted. Without this, deleted entities leak as stale rows that no live edit ever cleans up. The CLI sweep additionally deletes every row it finds in the retired `_timelineLaneEntries` collection — those are legacy leftovers from before the per-lane projection was removed. The `rebuildForCategoryRename` path is the one exception — it's a targeted refresh of one key, not a full rebuild, so it skips the sweep.

## Search service

When the *Catalog → Full-text search* backlog item from `narrative-engine-impl.md` is picked up, evaluate Typesense vs. Meilisearch on a small dataset first; pick the lower-friction option for the first ship. Sync hook design (Cloud Function on Firestore write trigger vs. client-side dual-write) is deferred until the service is picked.

## Service-layer audit

One-pass sweep to enforce the *Portability posture* rules:

- Any `Timestamp`, `FieldValue`, or `DocumentReference` imported outside `*.service.ts` moves into a service.
- Any `EntityRef` consumer that branches on `kind` to compute a Firestore-specific value (collection path, ref shape) moves the branch into a resolver service.
