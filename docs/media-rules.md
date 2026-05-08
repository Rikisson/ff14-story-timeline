# Media rules

Standards for how media files (images, audio) are stored, authored, and
played. Rules only — design rationale belongs in conversation or in the
narrative-engine doc.

## Storage

- Metadata in Firestore, binaries in Firebase Storage.
- Storage path: `universes/{u}/{entityKind}/{entityId}/{assetKind}/{assetId}/{filename}`.
- Set `cacheControl: 'public, max-age=31536000'` on every upload.
- New uploads get new asset IDs; never overwrite an existing object.

## Schema

- Asset libraries are inline arrays on the owning entity document.
- Asset entry minimum shape: `{ id, label, url }`. Per-kind optional fields are additive.
- Cover images are a single `coverImage?: string` field on the entity.
- Asset tag fields are `string[]`, free-form. No enums.

## Editor

- Libraries are managed on the owner entity's edit page: upload, rename, reorder, delete (with confirm on delete).
- Scene editor picks from existing libraries — no scene-level uploads to a library.
- Scene editor exposes a "custom" override that writes a raw URL onto `Scene.background` / `Scene.audio` for one-offs.
- Asset pickers filter by the asset's tag list when tags are present.

## Player

- The audio element lives in the player shell, not in `scene-view`.
- Backgrounds render as two stacked `<img>` elements with CSS opacity crossfade.
- Skip the crossfade when the next asset URL equals the current.
- On scene mount, preload backgrounds and audio of every scene reachable through `Scene.next[]`.
- Show a loading indicator on first scene only; subsequent transitions rely on preload.
