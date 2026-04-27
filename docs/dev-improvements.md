# Dev improvements

A snapshot review of the project, grouped into three buckets: technical debt,
feature debt, and new feature avenues. Use as a backlog reference; tick items
off as they ship.

## 1. Technical debt & optimizations

### Misc

- **Wildcard `redirectTo: ''`** silently swallows malformed URLs. No 404 page.
- **Confirm-before-leave with unsaved changes** missing in editor.
- **Vitest is wired but unused** — no coverage on stores, services, guards.
- **No Firebase API key restriction** — domain restriction in Cloud Console
  still pending. No code change required; pairs with the GitHub Pages deploy.
- **No pagination cursor / "Load more" UI** — list queries cap at 50 via
  `limit(50)`, but there's no UI or service method to fetch the next page.
  Pair with a "Load more" button when collections grow.

## 2. Feature debt & improvements to existing features

### Data-model coherence (biggest single source of friction)

- **Story↔Character/Place is free text, but seeds use IDs.**
  `SEED_STORY.mainCharacters = ['char-ingrid', ...]` (IDs); the meta panel
  shows them as comma-separated names; the catalog filter dropdown then
  presents a mix of IDs and names. Replace the CSV inputs with multi-select
  bound to the Characters/Places collections, store IDs everywhere, render
  names at display time.
- **Same problem on `Event`** — `event-form.component.ts:53` literally labels
  the field "comma-separated IDs" and the card renders raw IDs.
- **`speaker` is free text** in scenes, not tied to `mainCharacters`. Default
  to a select from the story's roster.
- **`inGameDate` is free text everywhere.** Sorting works (locale-numeric),
  but cross-story consistency is on the author. A small canonical date type
  (era + year + optional time-of-day) would unblock real timeline rendering.

### UI gaps in flows that already exist

- **Cannot delete a story from the UI.** Service has `deleteStory`; no button.
- **Editor isn't responsive.** `grid-template-columns: 280px 1fr 320px`
  (`editor.page.ts:103`) breaks below ~900 px.
- **No orphan-scene warning.** Scenes unreachable from `startSceneId` aren't
  flagged.
- **No drag-to-reorder choices.** Order matters in the player but the only way
  to change it is delete + recreate.
- **"Set as start" has no confirm.** Easy misclick.
- **No keyboard shortcuts** in the editor (Ctrl-S, Del, N).
- **Catalog list view excludes events.** Events only appear in the timeline
  view, so filtering by event in list view does nothing visible.
- **Filter dropdowns are single-select only.** Multi-select (OR within
  a category) is the standard expectation.
- **No catalog cover image override.** Card thumbnail is whatever
  `scenes[startSceneId].background` happens to be — give the story its own
  `coverImage` field.
- **Auth button is plain inline-styled HTML** — doesn't use the design-system
  buttons.
- **Subscription errors are swallowed** — `onSnapshot` has no error handler in
  any of the 4 services.
- **Seeder UI** has no confirm dialog; one click overwrites real data.
- **Editor header doesn't show draft/published state** — title only.
- **Player only offers Resume on first load.** Mid-session it's gone.
- **No upload size/type guard on `StoryAssetsService.upload`.**

## 3. New feature avenues

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
