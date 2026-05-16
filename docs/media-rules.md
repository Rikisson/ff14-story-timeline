# Media rules

How asset binaries and metadata are stored, authored, and loaded. Engine-level rendering (scene composition, crossfade, audio host, loading indicators) lives in `narrative-engine-impl.md` *Scene rendering layers*. Storage backend posture lives in `backend-rules.md`.

---

# Rules

## Storage

- Metadata in Firestore, binaries in Cloudflare R2 (see `backend-rules.md` *Binary storage*).
- Storage path: `universes/{u}/{assetKind}/{assetId}/{filename}`. Path encodes universe and asset kind only — never ownership. The same asset can be referenced by any number of entities.
- Uploads and deletes flow through the `media-signer` Worker (`cloudflare/media-signer/`), which checks the caller's Firebase id token + universe membership and returns a short-lived presigned R2 URL. The client `PUT`s/`DELETE`s the asset body directly to that URL; public reads come from the bucket's public base composed client-side as `${publicBase}/universes/{u}/{kind}/{assetId}/{filename}`. Worker contract and Cloudflare setup live in its README.
- One Worker + one bucket cover both localhost and the deployed app. Split into `[env.dev]` / `[env.prod]` (drafted in `wrangler.toml`) when real users would notice if a deploy broke things.
- `cacheControl: 'public, max-age=31536000'` on every upload.
- New uploads get new asset IDs; never overwrite an existing object.
- Image binaries are WebP on disk. Cover and background uploads accept JPEG, PNG, WebP, or AVIF and are downscaled + transcoded to WebP in-browser before the PUT. Sprite uploads accept WebP only — authored transparency is preserved bit-exact.
- Cover uploads emit two objects under the same asset directory: the full-res image and a 640w `.thumb.webp` variant for card slots. Both URLs live on the asset doc; consumers rendering at card scale prefer the thumb and fall back to the full URL for pre-thumb assets.
- Audio binaries are Opus or AAC, ≤ 128 kbps for ambient tracks.

## Schema

- Asset metadata lives in a central per-universe collection: `universes/{u}/_assets/{assetId}`. One doc per uploaded asset.
- Asset doc shape: `{ id, kind, url, thumbUrl?, label, blurDataUrl?, tags?, authorUid, createdAt, updatedAt? }`. `kind` matches the value used in the storage path. `thumbUrl` is populated for cover assets and points at the 640w `.thumb.webp` sibling object.
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
- Uploads enforce max file size and a minimum source width before write. Oversize dimensions are downscaled — not rejected — so the user's first try succeeds; truly broken inputs (wrong mime, unreadable, below the floor) surface a clear error. Per-kind targets: cover and background scale to fit within 2560×1440 with a 1280px-wide floor; sprite stays bounded by 1600×2400.
- Owner entity edit pages select from the universe asset library (filtered by kind) to populate their asset-ID arrays. Reorder and remove are local operations on the entity; rename and delete-from-library happen on the asset doc itself.
- Scene editor picks asset references — no scene-level uploads bypass the library. Per-scene overrides (e.g. a flashback background) still register in the library; one-offs can be pruned later.
- Asset pickers filter by `kind` and by tag.

## Loading

- List, timeline, and picker surfaces resolve asset URLs lazily by ID through `AssetThumbResolver` (see `backend-rules.md` *Asset references*). The resolver collects visible `coverAssetId`s, fetches matching `_assets` docs in chunks of up to 30 (Firestore `in` cap), caches by `(universeId, assetId)` for the session, and renders `thumbUrl ?? url`. Universe-wide preload of `_assets` is reserved for surfaces that genuinely need the whole library — the asset library / picker, and the player today as a temporary bridge.
- On scene mount, preload backgrounds and audio of every scene reachable through `Scene.next[]`, scheduled inside `requestIdleCallback`.
- Skip preloads when `navigator.connection.saveData === true` or `effectiveType` is `slow-2g` or `2g`.

---

# Implementation

## Lazy asset resolver

`AssetThumbResolver` does not exist yet. It owns by-ID asset hydration for every list, timeline, picker, and detail surface that needs URLs but not the rest of the asset doc. Ship as a `providedIn: 'root'` service exposing a signal-returning `resolveManyThumbs(ids)`; back it with a session-scoped cache keyed by `(universeId, assetId)`. New code must not reach into `MediaAssetsService.assets()` — that signal is a player-only bridge (see `backend-rules.md` *Player bridge*).
