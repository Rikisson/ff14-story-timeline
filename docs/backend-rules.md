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

## Realtime listeners

`onSnapshot` is opt-in, not the default.

- **Use a listener** for editor auto-save / conflict resolution and player-side cloud-sync slots — both have a clear "another writer may change this while I have it open" story.
- **Do not use a listener** for catalog browsing, public detail pages, timeline rendering, or any read-only consumer surface. A one-shot `getDocs` + client cache is correct.
- Listener charges include rule re-evaluation on reconnect and on rule deploys; on public collections they multiply by audience size.

## Pagination and filtering

- **Cursor-based only** (`startAfter` / `endBefore`). No arbitrary page-N skips — Firestore can't, and "View more" is the consumer surface anyway.
- **Every public-list filter combination requires a composite index**, enumerated in `firestore.indexes.json`. Ad-hoc client-side filtering after a loose query is not the answer.
- **Total-count badges use `count()` aggregation** — one read per invocation, not one per matched doc — and are cached client-side for the session.
- **`array-contains-any` caps at 10 values.** Tag filtering UIs enforce this at the picker; over-10 selections fan out into multiple queries client-side, or are rejected with a clear message.

## Search

- **Out of scope until full-text search ships.** Until then, list views filter on indexed scalar fields and `array-contains` only.
- **When search ships, it lives in a separate service.** Candidates in priority order: Typesense (self-hosted on a small VPS), Meilisearch (similar profile), Algolia (only if budget tolerates the price for operational simplicity).
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

Current check is read-then-write across `UniverseEntityService.assertSlugAvailable` and `UniversesService.findBySlug`; concurrent writers can both pass. Replace with a denormalized index doc at `universes/{id}/_slugIndex/{kind}_{slug}` mutated inside `runTransaction`, and route every slug check through the same helper.

## Server-side list filtering

Composite indexes per filter combination so tight filters don't depend on "View more" thrash through client-side filtering of the loaded page. Author the index manifest as the catalog filter UI lands; do not pre-author combos no UI exercises.

## Search service

- When the *Catalog → Full-text search* item from `narrative-engine-impl.md` is picked up, evaluate Typesense vs. Meilisearch on a small dataset first; pick the lower-friction option for the first ship.
- Sync hook design (Cloud Function on Firestore write trigger vs. client-side dual-write) is deferred until the service is picked.

## Service-layer audit

One-pass sweep to enforce the *Portability posture* rules:

- Any `Timestamp`, `FieldValue`, or `DocumentReference` imported outside `*.service.ts` moves into a service.
- Any `EntityRef` consumer that branches on `kind` to compute a Firestore-specific value (collection path, ref shape) moves the branch into a resolver service.
