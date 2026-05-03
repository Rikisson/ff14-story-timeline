# Dev improvements

A snapshot review of the project, grouped into two buckets: technical debt
and new feature avenues. Use as a backlog reference; tick items off as
they ship.

## 1. Technical debt & optimizations

### Misc

- **No Firebase API key restriction** — domain restriction in Cloud Console
  still pending. No code change required; pairs with the GitHub Pages deploy.
- **List filters run client-side over the loaded page.** Master-detail list
  pages paginate via Firestore cursors, but filters (characters, places,
  plotlines) are applied to the already-loaded set. Selecting a tight filter
  on a large collection may show very few matches until the user clicks
  "View more" enough times. Server-side filtering needs composite indexes
  per filter combination — meaningful per-feature work, not blanket.
- **Test coverage is thin.** Editor and player stores have basic specs;
  services, guards, and components are still uncovered.

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

- **Entity media — image per entity.** Characters, places, items, factions,
  events, plotlines, codex entries should accept an uploaded image (cover or
  portrait). Storage layout mirrors the existing per-character portrait
  uploads; surface in the detail pane.
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
