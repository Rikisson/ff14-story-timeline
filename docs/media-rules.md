# Media rules

Two parts:
- **Rules** — standing constraints on how media files are stored,
  authored, and loaded.
- **Implementation** — open media changes still to ship. Items are
  removed when shipped; this section is not a history.

Engine-level rendering concerns (scene composition, crossfade, audio
host, loading indicators) live in `narrative-engine-impl.md` under
*Scene rendering layers*.

---

# Rules

## Storage

- Metadata in Firestore, binaries in Firebase Storage.
- Storage path: `universes/{u}/{assetKind}/{assetId}/{filename}`. The path encodes only the universe and the asset kind; ownership is never encoded in the path. The same asset can be referenced by any number of entities.
- Set `cacheControl: 'public, max-age=31536000'` on every upload.
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

- Uploads register a new doc in `_assets` and a binary in Storage; both writes succeed or both are rolled back.
- Uploads enforce max file size and max dimensions before write; oversize files are rejected with a clear error.
- Owner entity edit pages select from the universe asset library (filtered by kind) to populate their asset-ID arrays. Reorder and remove are local operations on the entity; rename and delete-from-library happen on the asset doc itself.
- Scene editor picks asset references — no scene-level uploads bypass the library. Per-scene overrides (e.g. a flashback background) still register in the library; one-offs can be pruned later.
- Asset pickers filter by `kind` and by tag.

## Loading

- On scene mount, preload backgrounds and audio of every scene reachable through `Scene.next[]`, scheduled inside `requestIdleCallback`.
- Skip preloads when `navigator.connection.saveData === true` or `effectiveType` is `slow-2g` or `2g`.

---

# Implementation

Open changes. Remove items as they ship.
