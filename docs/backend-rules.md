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

`{ kind, entityId, label, labelFolded, slug, coverAssetId?, secondary?, categoryKey?, status?, visiblePublic, draft?, updatedAt }`

Powers related-ref pickers, inline-ref suggestions, plotline filter selectors, resolver chips, and generic "find entity" UI. Prefix search uses `labelFolded` with `startAt(q) / endAt(q + '\uf8ff')` (high-codepoint sentinel), capped at 20 results.

`visiblePublic` is uniform across kinds: `true` by default, and `!draft` for kinds that carry draft state (Story today; other kinds may gain it later without changing the index shape). The same field gates every public-surface query.

The per-kind `secondary` line follows the rules in `narrative-engine-impl.md` *Scope locks* — the projection writer is responsible for computing it at write time so consumers never have to resolve cross-entity refs to render a list row.

### Timeline projections

`universes/{u}/_timelineEntries/{kind}_{id}` for the mixed story+event date stream, and `universes/{u}/_timelineLaneEntries/{laneKey}_{kind}_{id}` for plotline-filtered swimlanes. Each row carries `title, coverAssetId, inGameDate, dateSortKey, dateKnown, plotlineIds[], characterIds[], placeIds[], draft, visiblePublic, updatedAt`. Entries with no plotline land in `laneKey: '__unassigned__'`.

The projection interleaves stories and events by date — do not fetch them separately and stitch client-side. A multi-plotline UI runs one query per selected lane with its own cursor; `array-contains-any` caps at 10 and forecloses per-lane pagination, so fan-out is the cost shape.

`dateDisplay` is not stored. The client formats from `inGameDate` through `formatInGameDate` (see `narrative-engine-impl.md` *Calendar*) so a calendar config edit doesn't require a content rewrite.

### Asset references

Projections store `coverAssetId` only; URLs live on `_assets/{assetId}`. List and timeline rendering resolves visible asset IDs lazily through a shared `AssetThumbResolver` that batches `in` queries (Firestore caps `in` at 30), caches by `(universeId, assetId)` for the session, and falls back from `thumbUrl` to `url` for assets uploaded before the thumb pipeline. Loading a universe must never preload the entire `_assets` collection for a public list, timeline, or picker surface.

### Inline-ref resolution

A scene with N `${kind:guid}` tokens hydrates through a shared `EntityResolverCache` that collects unknown IDs across the body and issues batched `in` reads (max 30 per chunk). The cache is session-scoped and keyed by `(universeId, kind, id)`. Per-token `getDoc` is the anti-pattern.

### No partial-array indexes

A picker, search input, inline-ref resolver, or timeline view that needs to *find* entities reads through directory or timeline projections via a query-scoped store. The first-page cache that a per-kind list service happens to hold is not an index; `.find()` over it misses everything past the first page and is a correctness bug, not a perf concern.

### Folded keys

`labelFolded` and `titleFolded` use a single shared normalizer: NFKD form, lowercased, diacritics stripped. Every writer of a projection row routes through the same util — divergent folding misses prefix queries silently.

### Write discipline

Entity create / update / delete writes canonical + projection docs in a single `writeBatch`:

- canonical doc
- `_directory/{kind}_{id}`
- `_timelineEntries/{kind}_{id}` for story / event only
- `_timelineLaneEntries/{laneKey}_{kind}_{id}` for story / event only
- the relevant `_slugIndex/{kind}_{slug}` entries (see *Atomic slug uniqueness* in Implementation)

Two lifecycle transitions invalidate projection rows beyond the canonical edit:

- **Publish / unpublish** flips `visiblePublic` across every projection row for that entity.
- **Calendar config change** invalidates `dateSortKey` for every story and event in the universe; a settings-side action triggers a projection rebuild at universe scope.

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

## Atomic slug uniqueness

The current check reads-then-writes across `UniverseEntityService.assertSlugAvailable` and `UniversesService.findBySlug`; concurrent writers can both pass. Replace with a denormalized index doc at `universes/{id}/_slugIndex/{kind}_{slug}` mutated inside the same `writeBatch` as the rest of the entity write (see *Write discipline* in Rules), and route every slug check through the same helper.

## Firestore indexes manifest

`firestore.indexes.json` doesn't exist yet; create it and wire it through `firebase.json`. Add composite indexes as the UI exercises each combination — don't pre-author combos no picker, list, or timeline view actually runs.

Day-one combinations:

- `_directory`: `(kind, labelFolded)`, `(visiblePublic, labelFolded)`
- `_timelineEntries`: `(visiblePublic, dateKnown, dateSortKey)`
- `_timelineLaneEntries`: `(visiblePublic, laneKey, dateKnown, dateSortKey)`
- `codexEntries`: `(categoryKey, titleFolded)`

Character / place timeline filter indexes wait until the timeline UI offers those filters.

## Projection writers and rebuild

Per-entity write paths fan out by hand to canonical, directory, and timeline / lane docs. Extract a shared `withEntityProjections` helper so each kind's service writes through one call; the helper owns the batch, the folding, the `secondary` computation, and the lifecycle flips for `visiblePublic`.

Ship a `rebuild-projections {universeId}` script (CLI against a deploy-authenticated context) that walks canonical docs and rewrites every directory / timeline / lane row. Used after schema changes, calendar edits, or partial-batch recovery.

## Search service

When the *Catalog → Full-text search* backlog item from `narrative-engine-impl.md` is picked up, evaluate Typesense vs. Meilisearch on a small dataset first; pick the lower-friction option for the first ship. Sync hook design (Cloud Function on Firestore write trigger vs. client-side dual-write) is deferred until the service is picked.

## Player bridge

`CharactersService.characters()` (and the per-kind sibling signals), `MediaAssetsService.assets()`, and `EntityResolverService.allInlineRefOptions` continue to preload universe-wide arrays so the player keeps working without rewrite. New picker, list, timeline, editor, and resolver code paths route through the directory / asset / resolver primitives in *Query architecture* — never through these signals.

Decommission the bridge when the player switches to scene-scoped hydration (see `narrative-engine-impl.md` *Player* backlog); the per-kind list signals collapse to query-store reads and the inline-ref array goes away entirely.

## Service-layer audit

One-pass sweep to enforce the *Portability posture* rules:

- Any `Timestamp`, `FieldValue`, or `DocumentReference` imported outside `*.service.ts` moves into a service.
- Any `EntityRef` consumer that branches on `kind` to compute a Firestore-specific value (collection path, ref shape) moves the branch into a resolver service.
- Any caller that reads a per-kind feature service's list signal (`characters()`, `events()`, etc.) for purposes other than the legacy player bridge moves to a directory / projection query.
