# Media rules

How asset binaries and metadata are stored, authored, and loaded. Engine-level rendering (scene composition, crossfade, audio host, loading indicators) lives in `narrative-engine-impl.md` *Scene rendering layers*. Storage backend posture lives in `backend-rules.md`.

---

# Rules

## Storage

- Metadata in Firestore, binaries in Cloudflare R2 (see `backend-rules.md` *Binary storage*).
- Storage path: `universes/{u}/{assetKind}/{assetId}/{filename}`. Path encodes universe and asset kind only — never ownership. The same asset can be referenced by any number of entities.
- `cacheControl: 'public, max-age=31536000'` on every upload.
- New uploads get new asset IDs; never overwrite an existing object.
- Image binaries are WebP; reject or transcode other formats at upload.
- Audio binaries are Opus or AAC, ≤ 128 kbps for ambient tracks.

## Schema

- Asset metadata lives in a central per-universe collection: `universes/{u}/_assets/{assetId}`. One doc per uploaded asset.
- Asset doc shape: `{ id, kind, url, label, blurDataUrl?, tags?, authorUid, createdAt, updatedAt? }`. `kind` matches the value used in the storage path.
- The v1 asset kind set:
  - `cover` — single decorative image per entity (cards, headers).
  - `sprite` — staged character image with alpha; swappable by mood, pose, expression, or outfit.
  - `background` — full-frame scene backdrop.
  - `ambient` — looping audio.
  - `sfx` — one-shot audio (voice, barks, environmental sounds).
- New kinds slot in additively without schema changes; pickers filter on the same field.
- Entities reference assets by ID, never by URL. Per-entity collections are `string[]` of asset IDs (e.g. `Character.sprites`, `Place.backgrounds`, `Place.ambientAudio`); single-asset slots are scalar IDs (e.g. `Universe.coverAssetId`, `StagedCharacter.spriteId`).
- Asset tags are `string[]` on the asset doc, free-form. No enums.

## Editor

- Uploads register a new doc in `_assets` and a binary in storage; both writes succeed or both are rolled back.
- Uploads enforce max file size and max dimensions before write; oversize files are rejected with a clear error.
- Owner entity edit pages select from the universe asset library (filtered by kind) to populate their asset-ID arrays. Reorder and remove are local operations on the entity; rename and delete-from-library happen on the asset doc itself.
- Scene editor picks asset references — no scene-level uploads bypass the library. Per-scene overrides (e.g. a flashback background) still register in the library; one-offs can be pruned later.
- Asset pickers filter by `kind` and by tag.

## Loading

- On scene mount, preload backgrounds and audio of every scene reachable through `Scene.next[]`, scheduled inside `requestIdleCallback`.
- Skip preloads when `navigator.connection.saveData === true` or `effectiveType` is `slow-2g` or `2g`.

---

# Implementation

## Cloudflare R2 wiring

Client and Worker code are committed; deploying R2 requires a Cloudflare account and is staged for when one is provisioned. The Worker source lives at `cloudflare/media-signer/`; setup steps are documented in its README.

Setup checklist (Cloudflare side):

- Create R2 buckets `narrative-dev` and `narrative-prod`; configure each for public reads.
- Bind a custom domain to each bucket (or note the `*.r2.dev` URL); set CORS to allow `PUT, DELETE` from the app origin.
- Create R2 API tokens scoped to each bucket; capture the access key id / secret.
- Run `wrangler login` then deploy the Worker to dev and prod (`pnpm deploy:dev` / `pnpm deploy:prod`); push secrets via `pnpm secret:dev` / `pnpm secret:prod`.
- Paste the Worker URL (`signerUrl`) and bucket public base (`publicBase`) into `src/app/r2.config.ts`.

Worker contract (`POST /sign-upload`, `POST /sign-delete`):

```
Headers: Authorization: Bearer <firebase-id-token>
Body:    { universeId, kind, assetId, filename }
```

Returns `{ uploadUrl }` or `{ deleteUrl }` — short-lived presigned R2 URLs. The client `PUT`s/`DELETE`s the asset body directly to that URL. Public read URL is composed client-side as `${publicBase}/universes/{u}/{kind}/{assetId}/{filename}` — never stored separately on the asset doc.

A migration step is intentionally absent: there is no production media to migrate. If real assets exist when R2 is brought up, write a one-shot script that lists `_assets` docs, re-uploads from the old `url` to R2, and patches `url` in a Firestore transaction.
