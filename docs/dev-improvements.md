# Dev improvements

A snapshot review of the project, grouped into two buckets: technical debt
and new feature avenues. Use as a backlog reference; tick items off as
they ship.

## 1. Technical debt & optimizations

### Misc

- **No Firebase API key restriction** — domain restriction in Cloud Console
  still pending. No code change required; pairs with the GitHub Pages deploy.
- **No pagination cursor / "Load more" UI** — list queries cap at 50 via
  `limit(50)`, but there's no UI or service method to fetch the next page.
  Pair with a "Load more" button when collections grow.
- **Test coverage is thin.** Editor and player stores have basic specs;
  services, guards, and components are still uncovered.

### Entity audit (2026-05-03)

Findings from a sweep across all 8 entity types
(`Character`, `Place`, `TimelineEvent`, `Story`, `CodexEntry`, `Faction`,
`Item`, `Plotline`) plus `Universe`. Ordered by impact.

- **Event form silently drops half of `TimelineEvent` on save.**
  `event.types.ts` defines `type`, `summary`, `sortOrder`, `consequences`,
  `relatedEvents`, `plotlineRefs`, `itemRefs`, `factionRefs`, but
  `event-form.component.ts` only emits `slug/name/inGameDate/description/
  mainCharacters/places/relatedDates`. On edit, `EventsService.update`
  spreads the partial draft with `updateDoc({ ...patch })`, wiping the
  unauthored fields. Same audit needed on the `Story` editor for
  `genreTags`, `toneTags`, `relatedEvents`, `plotlineRefs`, `itemRefs`,
  `factionRefs`.
- **`updatedAt` is set inconsistently across services.** `codex-entries`,
  `factions`, `items`, `plotlines` set it on `update`. `characters`,
  `places`, `events` do not. Stories use a different mechanism
  (transaction + `version`). Anything sorting/displaying `updatedAt` will
  silently disagree.
- **Massive duplication across the 8 universe-scoped services.** Each is
  ~120 lines, ~95% identical (constructor effect, `refresh`,
  `assertSlugAvailable`, `requireUniverseId`, error handling). A generic
  `createUniverseEntityService<T, Draft>({ collection, kind })` factory
  or base class would collapse ~700 LOC and fixes the `updatedAt`,
  shadow-error, and refresh-cancellation issues in one place.
- **Event card renders raw UUIDs as chips.** `event-card.component.ts`
  outputs `c.id` / `p.id` (EntityRef GUIDs) directly. Other cards
  (`faction-card`, `item-card`, `codex-entry-card`) resolve names via
  injected services. Fix the event card or extract a shared
  `<app-entity-chip [ref]="…" />`.
- **Two different `SlugTakenError` classes.** `@shared/models/slug.ts`
  exports one (with `kind`); `universes.service.ts` defines a second
  class with the same name but no `kind` field. Consumers catching the
  shared import will miss universe slug collisions.
- **`UniversesService.create()` drops `coverImage` and `tags`.**
  `UniverseDraft` advertises them, but only `slug/name/description/
  ownerUid` is persisted. Either wire them or remove them from the draft.
- **`authorUid` is stored on every entity but never enforced.** Every
  page's `canEdit(entity)` returns `this.canCreate()`, so any universe
  member can edit any record regardless of who authored it. Either honor
  `authorUid` for per-record edit gating or stop storing it.
- **Concurrent-write protection only exists for stories.**
  `StoriesService.saveStory` uses `runTransaction` + `version`.
  Characters/events/items/etc. have the same multi-editor risk
  (`editorUids`) but use plain `updateDoc({ ...patch })` — last write
  wins silently.
- **Effect-driven refresh has no cancellation / sequence guard.** Each
  service's constructor fires `refresh(id)` whenever `activeUniverseId`
  changes. Rapid switches can let an older promise resolve last and
  overwrite newer state. CLAUDE.md prescribes `rxMethod` + `tapResponse`
  for this; none of the services use it.
- **`Place.factions: string[]` is now visibly asymmetric.**
  `Faction.relatedPlaces` is `EntityRef<'place'>[]`, but the inverse on
  `Place` is free strings. `docs/narrative-engine-impl.md` locks this as
  descriptive, so it's intentional — but it deserves a one-line comment
  on the field pointing at the doc.
- **`CodexEntry.relatedRefs?: EntityRef[]` is the only `EntityKind`-untyped
  related field.** Every other "related" field narrows the kind union;
  this allows nonsensical refs (e.g. codex entry → itself).
- **List-page Mode/busy/error state machine is duplicated** across every
  page component (`Mode = idle | create | edit`, `confirmRemove` with
  `confirm()`, identical `onSubmit`/`startEdit` flow). A small
  `useEntityListPage()`-style helper would dedupe.

## 2. New feature avenues

### Player / reader experience

- **Markdown or limited rich text** in scene body.
- **Variables + conditional choices** — flags, inventory, branch locks.
- **Multiple save slots** per story; cloud sync.
- **Reading-progress badges** ("In progress" / "Completed" / "Endings N/M").
- **Player preferences** — text speed, font size, BGM volume; persisted.
- **Layered audio** — BGM track + per-scene SFX/voice line.
- **PWA / offline reading** — manifest + service worker.

### Catalog / discovery

- **Tags & genres** with tag-based filtering.
- **Full-text search** across stories, characters, places, events.
- **Sort by recency / popularity / length**.
- **Story collections / series** — explicit ordering across multiple stories.
- **Public author profile pages**.

### World-building

- **Detail pages for Characters, Places, Events** (today they're list-only).
- **Map view of places** — store lat/lon, render with leaflet/maplibre.
- **Relationship graph** — Rete is already in the bundle; reuse it.
- **Asset library** — reuse uploaded backgrounds/portraits across stories.
- **Canonical `inGameDate` type** — currently free text; locale-numeric
  sorting works but cross-story consistency is on the author. An era + year
  (+ optional time-of-day) type would unblock real timeline rendering.

### Editor / authoring

- **Auto-save** with conflict resolution.
- **Revision history / undo-redo** — `revisions/` subcollection.
- **Story templates** — "Linear", "Branching with reunion", "VN skeleton".
- **AI-assisted scene drafting** via Claude API.
- **Co-authoring** — Firestore presence + multi-cursor.
- **Import / export** (JSON).
- **Print / PDF export** of a story walkthrough.

### Platform

- **i18n** — `@angular/localize` for ENG/JPN.
- **Dark mode** — Tailwind `dark:` variants.
- **Comments / reactions** on stories.
- **Achievements** (endings discovered, hidden scenes found).
