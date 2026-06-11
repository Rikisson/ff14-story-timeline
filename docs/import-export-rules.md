# Import / export rules

Universe import/export turns a universe into a portable `.universe` archive and
back, and lets authors hand a JSON schema to a 3rd-party AI to draft a universe from
notes. The feature lives in `src/features/universe-transfer/`; the AI-facing kit
lives in `public/migration-kit/`.

The archive format is a **second, parallel representation of the persisted entity
model**. Nothing derives it automatically. When the entity model changes and this
feature is not updated to match, export silently drops the new data and import
silently ignores it — and the validators will not catch it, because they check what
a file *contains*, never what it *omits*. Round-trip fidelity is exactly as good as
this feature's sync with the model. That sync is the core maintenance obligation —
treat the rest of this document as the map for keeping it.

---

# Rules

## The feature at a glance

Pure format core (no Angular, no Firestore — unit-tested):

- `data-access/archive-format.ts` — every `Archive*` interface and `UniverseArchive`, plus `FORMAT_VERSION`, `ARCHIVE_ENTITY_KINDS`, `COLLECTION_BY_KIND`.
- `data-access/archive-zip.ts` — `.universe` zip read/write (`fflate`).
- `data-access/validate-structure.ts` — shape, types, enums, slugs, scene-graph integrity, story size limit.
- `data-access/validate-semantics.ts` — cross-reference resolution, slug collisions, config prerequisites, "did you mean" hints.
- `data-access/resolve-refs.ts` — slug↔id rewriting for structured refs and inline `${kind:…}` tokens.
- `data-access/mint-ids.ts` — GUID minting, slug-collision resolution, the `ImportContext` shape.
- `data-access/to-archive.ts` — canonical entities → `UniverseArchive` (export down-conversion).
- `data-access/build-canonical-docs.ts` — `UniverseArchive` → canonical Firestore docs (import up-conversion).
- `data-access/auto-layout-scenes.ts` — scene-graph layout when a scene omits `position`.

Angular services:

- `data-access/export-read.service.ts` — raw Firestore reads for export.
- `data-access/import-context.service.ts` — reads the target universe's slugs, calendar, and categories.
- `data-access/universe-export.service.ts` — export orchestration: gather → archive → R2 binary download → zip.
- `data-access/universe-import.service.ts` — `dryRun()` and `commit()`; config application, R2 upload, the per-kind write dispatch.

UI lives in `feature/` and `ui/`; strings in `i18n/` (`universeTransfer` scope). The
Migration Kit is `public/migration-kit/`.

## Changing the entity model — the maintenance contract

When you change anything below, update every listed site **in the same change**. A
miss does not fail the build or the tests; it silently corrupts a round-trip.

**A field on a persisted entity** (`Character`, `Place`, `TimelineEvent`,
`Plotline`, `CodexEntry`, `Story` metadata, `Universe`):

- `archive-format.ts` — the matching `Archive*` interface.
- `to-archive.ts` — carry the field on export.
- `build-canonical-docs.ts` — carry the field on import.
- `validate-structure.ts` — validate it (required? type? enum?).
- If it holds an `EntityRef` or inline-ref prose → also confirm `validate-semantics.ts` resolves it.
- If it holds an asset id → the asset-field handling in `to-archive.ts` and `build-canonical-docs.ts` (asset-id fields are renamed in the archive — e.g. `coverAssetId` → `coverAsset`).
- The Migration Kit: `universe.schema.json`, and consider showing it in `example-universe.json`.

**The scene model** (`Scene`, `StagedCharacter`, a new layout / transition / effect
value): `archive-format.ts` (`ArchiveScene`, `ArchiveStagedCharacter`), the scene
functions in `to-archive.ts` and `build-canonical-docs.ts`, `validateScene` in
`validate-structure.ts`, the `scene` definition in `universe.schema.json`. If it
affects graph shape, `auto-layout-scenes.ts`.

**The connection model** (`Connection`, its endpoints, visibility): connections are
*not* an archive entity kind — they ride as a top-level `connections[]` array with
no slug and no id minting; identity is rebuilt from endpoints at import via the
deterministic doc id. The sites: `archive-format.ts` (`ArchiveConnection*`),
`toArchiveConnections` in `to-archive.ts` (which consumes the per-story
scene-key maps collected during story serialization), `buildConnections` in
`build-canonical-docs.ts` (which consumes the per-story minted scene-id maps),
`validateConnection*` in `validate-structure.ts`, `checkConnections` in
`validate-semantics.ts`, the plain `setDoc` loop in `universe-import.service.ts`,
the `connections` collection read in `export-read.service.ts`, and the
`connection` definition in `universe.schema.json`.

**A new entity kind** — a large change. `ARCHIVE_ENTITY_KINDS` and
`COLLECTION_BY_KIND`, a new `Archive*` interface added to `UniverseArchive`,
`to-archive.ts`, `build-canonical-docs.ts` (the kind switch), both validators,
`mint-ids.ts` (`archiveEntitiesOf`, `blankKindMaps`), `universe-import.service.ts`
(`buildInputsFor` and `writeDoc`), `export-read.service.ts`,
`import-context.service.ts`, the export panel's kind checkboxes, the
`universeTransfer.enum.*` i18n keys, and the whole Migration Kit.

**An enum** (`BackgroundEffect`, `TextSpeed`, `BgmTransition`, `SceneLayout`,
`SceneTransition`, `PlotlineStatus`, `AssetKind`, `UniverseLocale`):
`validate-structure.ts` keeps **hard-coded copies** of these value lists — update
them — and update the matching `enum` in `universe.schema.json`.

**`EntityRef` or the inline-ref token format:** `resolve-refs.ts`,
`validate-semantics.ts`, and `ArchiveRef` in `archive-format.ts`. The feature reuses
`INLINE_REF_REGEX` / `parseRefs` / `buildInlineRef` from `@shared/utils`; if those
change, re-check `resolve-refs.ts`, `validate-semantics.ts`, the prefix table in the
Migration Kit README, and the schema.

**The calendar or codex-category model:** `archive-format.ts`
(`ArchiveCalendar*`, `ArchiveCodexCategory`), `buildCalendar` /
`toArchiveCategories` in `to-archive.ts`, `buildCalendar` / `applyCategories` in
`universe-import.service.ts`, `import-context.service.ts`, the calendar/category
validators in `validate-structure.ts`, and the schema.

**A Firestore collection name or document path:** `export-read.service.ts`,
`import-context.service.ts`, and the commit write path in
`universe-import.service.ts` hard-code paths — by design, the feature does not read
through the per-kind services. Update all three.

**The projection write path:** the import commit reuses
`writeEntityWithProjections` and the per-kind `build*DirectoryInputs` /
`build*TimelineInputs`. If those signatures change, update `buildInputsFor` in
`universe-import.service.ts`.

## `FORMAT_VERSION` and archive compatibility

The importer requires `formatVersion` to equal `FORMAT_VERSION` exactly.

- A purely additive change — a new **optional** field — does **not** need a bump.
  Old archives still validate (the field is simply absent); new archives carry it.
- A breaking change — a renamed or removed field, a changed shape, a new
  **required** field — needs a `FORMAT_VERSION` bump. Bumping rejects every older
  archive with "unsupported formatVersion". That is acceptable: `.universe` files
  are short-lived exchange artifacts, not a store of record. There is no migration
  path for old archives, by design — do not build one without a reason.

## The Migration Kit is hand-maintained and AI-facing

`public/migration-kit/` — `universe.schema.json`, `example-universe.json`,
`README.md` — is what users paste into a 3rd-party AI. None of it derives from the
format automatically. When the format changes, update the schema's shape and
per-field descriptions, keep the example valid (and demonstrate a notable new
field), and update the README prose if author-facing behavior changed.

The drift guard (`migration-kit.spec.ts`) only asserts the example still passes
`validateStructure` and `validateSemantics`. It does **not** detect a stale schema
or an example that fails to exercise a new field — those are on you.

The README's scene-craft guidance (scene granularity, the title-card first scene,
`speaker` discipline) was tuned against real Gemini / GPT / Claude output. Change it
deliberately, not casually.

## Deliberate omissions and invariants

These are design decisions, not gaps. Do not "fix" them.

- **Projections** (`_directory`, `_timelineEntries`, `_timelineLaneEntries`) and the
  **slug index** (`_slugIndex`) are never exported or imported — they are
  regenerable, and the import rebuilds them through the normal write path.
- **Server-managed fields** — `id`, `authorUid`, `editorUids`, `createdAt` /
  `updatedAt` / `publishedAt`, `version`, `sourceFingerprint`, and the
  universe-level counter trio `deletedAt` / `storageBytes` / `assetCount`, plus the
  per-asset `objects` / `totalBytes` — are omitted from the format. The importer
  mints or sets them, recomputing the counters from the imported asset bytes rather
  than trusting any source-environment value. Per-asset imports commit through a
  Firestore `runTransaction` that writes the `_assets/{assetId}` doc and bumps the
  host universe's `storageBytes` / `assetCount` in one step — mirroring the live
  upload pipeline. The validator notes any of these fields as *info* and ignores
  them if a file supplies them.
- Entities are keyed and cross-referenced by **slug**, never raw id. This is what
  makes a package portable between universes — keep it.
- **Connection endpoints are slug-keyed and archive-internal.** `story` / `event`
  fields hold entity slugs; `scene` holds the archive-local scene key (the same
  keys `next[].scene` uses). Scene keys mean nothing against an already-imported
  universe, so both endpoints must resolve inside the same archive — semantics
  rejects anything else, and export silently drops a connection whose endpoint
  isn't in the export set (this is also how connections ride along automatically
  with no kind checkbox in the export panel). The derived `fromEntityKey` /
  `toEntityKey` query fields and `createdBy` / `updatedBy` / `updatedAt` are never
  serialized — the importer re-derives and re-stamps them.
- **Import is additive.** It merges into the active universe, never creates one, and
  never deletes or overwrites existing entities. A slug collision is resolved by
  *skip* or *rename*, never overwrite. Any extension of the import path must
  preserve this — it is the feature's safety guarantee.

## Operational — R2 CORS for export

`universe-export.service.ts` downloads each asset binary with `fetch(asset.url)`
against the R2 public bucket. The bucket must serve assets with permissive CORS
(GET) or binary export degrades to metadata-only — the export still succeeds, with a
skipped-files count in the result. If asset export quietly produces archives with no
binaries, check the R2 bucket's CORS policy first.

---

# Implementation

*(Empty — the feature is shipped. Format changes are governed by the Rules above,
not tracked here.)*
