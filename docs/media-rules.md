# Media rules

How asset binaries and metadata are stored, authored, and loaded. Engine-level rendering (scene composition, crossfade, audio host, loading indicators) lives in `narrative-engine-impl.md` *Scene rendering layers*. Storage backend posture lives in `backend-rules.md`.

---

# Rules

## Storage

- Metadata in Firestore, binaries in Cloudflare R2 (see `backend-rules.md` *Binary storage*).
- Storage path: `universes/{u}/{assetKind}/{assetId}/{filename}`. Path encodes universe and asset kind only — never ownership. The same asset can be referenced by any number of entities.
- Uploads and deletes flow through the `media-signer` Worker (`cloudflare/media-signer/`), which checks the caller's Firebase id token + universe membership and returns a short-lived presigned R2 URL. The client `PUT`s/`DELETE`s the asset body directly to that URL; public reads come from the bucket's public base composed client-side as `${publicBase}/universes/{u}/{kind}/{assetId}/{filename}`. Worker contract and Cloudflare setup live in its README.
- One Worker + one bucket cover both localhost and the deployed app. Split into `[env.dev]` / `[env.prod]` (drafted in `wrangler.toml`) when real users would notice if a deploy broke things.
- **Per-kind stored byte caps**, enforced at the `media-signer` Worker on every `/sign-upload`. The client computes `byteLength` after transcoding and sends it with the sign request; the Worker checks it against the kind cap and against the host universe's remaining storage headroom (per `backend-rules.md` *Cost canaries*), then signs the PUT URL with a `Content-Length` binding so R2 rejects mismatched bodies.

  | Kind | Stored cap |
  |---|---|
  | `cover` | 2.5 MiB |
  | `background` | 2.5 MiB |
  | `sprite` | 5 MiB |
  | `ambient` | 15 MiB |
  | `sfx` | 3 MiB |

  Cover thumbnails (`.thumb.webp` sibling object, 640w lossy WebP at ~0.7 quality) sign without a separate kind cap but count toward universe storage.

  **What `byteLength` is per kind** (because the cap is post-transcode, the practical headroom differs sharply):
  - `cover`, `background`: lossy WebP at quality 0.75, downscaled to fit 2560×1440. **Small images are never upscaled** — a 1920×1080 input stays 1920×1080. A typical transcoded frame lands at 100–800 KB, so the 2.5 MiB cap is generous overflow and rarely binds.
  - `sprite`: an in-bounds WebP is stored byte-for-byte (lossless passthrough, no canvas roundtrip); anything else is re-encoded losslessly through `canvas.toBlob('image/webp', 1)` and downscaled to fit 1440×2560 if oversize. Same no-upscale rule. Detail-heavy 1440×2560 sprites with alpha can land at 3–5 MiB, so the 5 MiB cap is the realistic ceiling.
  - `ambient`, `sfx`: no transcode — `byteLength` is the file as authored. Roughly `duration × bitrate`, so at 128 kbps Opus the 15 MiB ambient cap fits ~15 min, the 3 MiB sfx cap fits ~3 min. Lower bitrate buys longer duration at the cost of fidelity. There is no separate duration gate; the byte cap is the only limit.
- `cacheControl: 'public, max-age=31536000'` on every upload.
- New uploads get new asset IDs; never overwrite an existing object.
- Image binaries are WebP on disk. Cover, background, and sprite uploads accept JPEG, PNG, WebP, or AVIF. Cover and background are downscaled and transcoded to lossy WebP in-browser before the PUT. Sprites are normalized losslessly: an in-bounds WebP is stored byte-for-byte so authored transparency stays bit-exact, while a non-WebP or oversize sprite is downscaled and re-encoded through `canvas.toBlob('image/webp', 1)` — lossless on Chromium, a max-quality WebP on Firefox, with a lossless PNG fallback where the browser cannot encode WebP. The lossy cover/background path is never used for a sprite.
- Cover uploads emit two objects under the same asset directory: the full-res image and a 640w `.thumb.webp` variant for card slots. Both URLs live on the asset doc; consumers rendering at card scale prefer the thumb and fall back to the full URL for pre-thumb assets.
- Audio binaries pass through as authored — no in-browser transcode. Accepted containers cover WebM, Ogg, MP4/M4A, MP3, and raw Opus/AAC streams (`.webm`, `.weba`, `.ogg`, `.oga`, `.opus`, `.m4a`, `.aac`, `.mp3`). The upload picker accepts files by extension as well as MIME, because Windows tags `.webm` as `video/webm` by OS mapping and would otherwise hide audio-only WebM in the file dialog. Codec guidance for ambient tracks: Opus or AAC at ≤ 128 kbps. AAC (`.m4a`) and Ogg-Opus play across every browser including Safari; WebM-Opus is fine on Chromium/Firefox but Safari support is intermittent — surface this trade-off in the audio picker's upload hint so authors targeting broad reach default to the safer containers.

## Schema

- Asset metadata lives in a central per-universe collection: `universes/{u}/_assets/{assetId}`. One doc per uploaded asset.
- Asset doc shape: `{ id, kind, url, thumbUrl?, label, blurDataUrl?, tags?, authorUid, objects, totalBytes, createdAt, updatedAt? }`. `kind` matches the value used in the storage path. `thumbUrl` is populated for cover assets and points at the 640w `.thumb.webp` sibling object. `objects: { key, bytes }[]` carries one entry per R2 object backing the asset — a cover asset has two entries (full + thumb), everything else has one. `totalBytes` is the sum of `objects[].bytes` and feeds the universe-level `storageBytes` counter and the reconciliation script.
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
- Upload commit is a Firestore `runTransaction` writing the `_assets/{assetId}` doc and bumping the host universe's `storageBytes` / `assetCount` counters in one atomic step. On failure after R2 bytes have already landed, the client best-effort `DELETE`s those objects via the Worker so the bucket doesn't accumulate orphans. Delete is the symmetric `runTransaction`: `tx.get` reads `totalBytes`, `tx.delete` removes the doc, `tx.update` decrements counters; the R2 cleanup routes through `/bulk-delete` to avoid browser concurrent-connection limits when a cover (full + thumb) is removed.
- Uploads enforce a max file size on every kind before write. Oversize dimensions are downscaled — not rejected — so the user's first try succeeds; truly broken inputs (wrong mime or unreadable) surface a clear error. Per-kind targets: cover and background fit within 2560×1440 (16:9); sprites fit within 1440×2560 (9:16) — the same pixel envelope rotated to portrait. Images smaller than the target are kept at their native dimensions, never upscaled. There is no minimum-dimension gate — a small but correctly framed asset is the author's call.
- Every image upload opens an in-browser crop step before the asset is created. The crop dialog opens at the aspect ratio the kind expects — 16:9 for covers and backgrounds, 9:16 for sprites — and also offers 1:1 and free-form; the author can reframe, switch ratios, flip the image horizontally, or skip cropping entirely with "Use full image". The horizontal flip normalizes orientation at the upload boundary: on a sprite upload the crop step shows a hint that characters should face right, the facing the scene renderer assumes for an un-flipped sprite, so authors fix orientation here rather than fighting it at scene time. A flip always re-encodes the binary, so the byte-for-byte sprite passthrough described under *Storage* applies only to an un-flipped in-bounds WebP. The cropper is a standalone, reusable component wired once into the shared asset picker, so it covers every image-upload surface; the crop is re-encoded losslessly and preserves sprite transparency. Audio uploads skip it.
- Owner entity edit pages select from the universe asset library (filtered by kind) to populate their asset-ID arrays. Reorder and remove are local operations on the entity; rename and delete-from-library happen on the asset doc itself.
- Scene editor picks asset references — no scene-level uploads bypass the library. Per-scene overrides (e.g. a flashback background) still register in the library; one-offs can be pruned later.
- Asset pickers filter by `kind` and by tag.

## Loading

- **Entity surfaces resolve assets lazily by ID.** List cards, timeline rows, related-ref pickers, plotline selectors, cover slot pickers — anywhere an asset thumb renders alongside an entity it belongs to — go through `AssetThumbResolver` (see `backend-rules.md` *Asset references*). The resolver collects visible `coverAssetId`s, fetches matching `_assets` docs in chunks of up to 30 (Firestore `in` cap), caches by `(universeId, assetId)` for the session, and renders `thumbUrl ?? url`.
- **Lazy thumbs reserve their box.** The host element fixes the image dimensions (width × aspect-ratio CSS, or an explicit `width`/`height` on the placeholder) before the URL resolves, so the row layout is stable and the page doesn't reflow when the thumb fades in. A skeleton placeholder fills the box during the fetch; once `AssetThumbResolver` returns, render `thumbUrl ?? url` and let the image fade in over the skeleton. No layout shift between skeleton and loaded states.
- **Asset-library surfaces preload by kind/tag.** The asset library and asset-library-style pickers (the kind-or-tag filtered list where the asset itself is the subject) query `_assets` directly — preloading the relevant slice is the feature, not a violation.
- On scene mount, preload backgrounds and audio of every scene reachable through `Scene.next[]`, scheduled inside `requestIdleCallback`.
- Skip preloads when `navigator.connection.saveData === true` or `effectiveType` is `slow-2g` or `2g`.
