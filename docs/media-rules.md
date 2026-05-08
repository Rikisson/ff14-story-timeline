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
- Storage path: `universes/{u}/{entityKind}/{entityId}/{assetKind}/{assetId}/{filename}`.
- Set `cacheControl: 'public, max-age=31536000'` on every upload.
- New uploads get new asset IDs; never overwrite an existing object.
- Image binaries are WebP; reject or transcode other formats at upload.
- Audio binaries are Opus or AAC, ≤ 128 kbps for ambient tracks.

## Schema

- Asset libraries are inline arrays on the owning entity document.
- Asset entry minimum shape: `{ id, label, url }`. Per-kind optional fields are additive.
- Image asset entries carry an optional `blurDataUrl: string` for placeholder rendering.
- Cover images are a single `coverImage?: string` field on the entity.
- Asset tag fields are `string[]`, free-form. No enums.

## Editor

- Libraries are managed on the owner entity's edit page: upload, rename, reorder, delete (with confirm on delete).
- Uploads enforce max file size and max dimensions before write; oversize files are rejected with a clear error.
- Scene editor picks from existing libraries — no scene-level uploads to a library.
- Scene editor exposes a "custom" override that writes a raw URL onto `Scene.background` / `Scene.audio` for one-offs.
- Asset pickers filter by the asset's tag list when tags are present.

## Loading

- On scene mount, preload backgrounds and audio of every scene reachable through `Scene.next[]`, scheduled inside `requestIdleCallback`.
- Skip preloads when `navigator.connection.saveData === true` or `effectiveType` is `slow-2g` or `2g`.

---

# Implementation

Open changes. Remove items as they ship.

- Cover or portrait image upload across all entity kinds (Characters,
  Places, Events, Plotlines, Codex).
- Cross-entity asset library — reuse uploaded backgrounds and
  portraits across stories.
