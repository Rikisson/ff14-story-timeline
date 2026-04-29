# Dev improvements

A snapshot review of the project, grouped into three buckets: technical debt,
feature debt, and new feature avenues. Use as a backlog reference; tick items
off as they ship.

## 1. Technical debt & optimizations

### Misc

- **No Firebase API key restriction** — domain restriction in Cloud Console
  still pending. No code change required; pairs with the GitHub Pages deploy.
- **No pagination cursor / "Load more" UI** — list queries cap at 50 via
  `limit(50)`, but there's no UI or service method to fetch the next page.
  Pair with a "Load more" button when collections grow.
- **Test coverage is thin.** Editor and player stores have basic specs;
  services, guards, and components are still uncovered.

## 2. Feature debt & improvements to existing features

### Data-model coherence (biggest single source of friction)

Replace ad-hoc free-text entity links (CSV strings on Story/Event, no
link at all in scene bodies, no relational fields on Character/Place)
with a single `EntityRef` primitive (`{ kind, id }`) used wherever an
entity is mentioned. References appear on two surfaces — typed pickers
and inline `${kind:<guid>}[…]` tokens — and fields fall into four
semantic tiers. The same picker UX serves all of them, but the meanings
are not interchangeable:

| Tier        | Surface                                       | Purpose                | Drives runtime? |
|-------------|-----------------------------------------------|------------------------|-----------------|
| Curatorial  | Story-level fields                            | Catalog & filtering    | No              |
| Runtime     | `Scene.characters` / `speaker` / `place`      | Staging / placement    | Yes             |
| Factual     | `Event.*` refs, `Character.relatedCharacters` | World-building         | No              |
| Decorative  | Inline `${…}[…]` in any rich-text body        | Tooltip / hover-card   | No              |

Implementation specifics — TS types, Firestore layout, picker fuzzy
rules, edge cases, migration steps — live in
[`narrative-engine-impl.md`](narrative-engine-impl.md).

- **Everything lives inside a Universe.** Add a top-level `Universe`
  entity that scopes all Characters, Places, Events, and Stories,
  stored as Firestore subcollections (`universes/{id}/characters/{id}`
  etc.). Cross-universe references are forbidden in pickers and inline
  autocomplete — an author who wants the same entity in two universes
  duplicates it. Universe creation is gated by an admin-granted custom
  claim (long-term restricted; dev-bootstrap easy by setting the claim
  manually). Universe selection becomes the implicit context for every
  editor view, picker, and catalog query — users see "create universe
  → work inside it." Authorization shifts from per-entity `authorUid`
  to per-universe owner / editor membership.

- **Field surface — typed pickers replace every free-text entity
  field.** Multi/single-select bound to the active universe's
  collection, returning `EntityRef`. Existing CSV inputs to fix:
  `Story.mainCharacters` / `Story.places` (seed data uses IDs but the
  meta panel renders comma-separated names and the catalog filter
  shows mixed IDs and names); `Event.mainCharacters` / `Event.places`
  (`event-form.component.ts:53` literally labels these "comma-separated
  IDs"); `Scene.characters` and `Scene.speaker`. New fields:
  `Story.linkedEvents`, `Character.relatedCharacters`, `Scene.place`.
  Catalog filters consume the Story-level source so the ID/name mixing
  disappears.

- **Inline surface — `${kind:<guid>}[Display Text]` references inside
  any rich-text body.**
  - Typing `${` opens an autocomplete popup under the caret. Zero or
    one character after `${` matches names across all kinds in the
    active universe; once the kind prefix completes — `${ch` →
    characters, `${pl` → places, `${ev` → events — the list narrows
    to that kind and further typing fuzzy-filters by name and slug.
  - Picking inserts a reference token and places the caret between the
    brackets so the author types the display text immediately. The
    canonical stored form is `${kind:<guid>}[…]`; the editor renders
    the token as a chip showing slug + display text, hiding the raw
    GUID from the WYSIWYG view. Raw form appears only in JSON export.
  - Player and catalog render the bracketed display text as a link /
    hover-card resolved against the active universe; unresolved IDs
    fall back to plain bracket text (no broken link, no cross-universe
    fallback).
  - Popup scope is the active universe's full collection for that
    kind. Story meta is not a filter — meta is curatorial (deliberately
    omitting characters to avoid spoilers), not a permission list.
    Entries referenced elsewhere in the same story or scene can rank
    first as UX, but no entity is hidden.
  - Rich-text hosts: `Scene.text` and `Event.description` exist;
    promote `Story.summary` to rich text (catalog card needs a
    rich-text renderer); add `Character.description` and
    `Place.description`.

- **Resolved scene model.** Concrete shape now decided:
  - `Scene.speaker?: EntityRef<'character'> | string` — `EntityRef`
    for major characters (chip + portrait), free string for
    non-essential speakers (narrator, off-screen voice, inner
    thought), `undefined` for descriptive scenes with no speaker.
    Singular for v1; promotion to a multi-speaker array is
    backwards-compatible later.
  - `Scene.characters: StagedCharacter[]` — explicit on-stage roster.
    Each entry carries a `position` slot (extensible string; UI
    presets `left` / `center` / `right`) and optional `order` to
    disambiguate collisions in the same slot. One character instance
    per scene.
  - `Scene.place?: EntityRef<'place'>` and `Scene.background?: string`
    are independent: `place` is the canonical world reference
    (timeline / map / consistency); `background` is the rendered
    asset.
  - A speaker referencing a character not in `characters[]` triggers a
    visible editor prompt ("speaker not on stage — add?") rather than
    silently mutating the array.

- **Decorative tier explicitly carved out.** Inline `${kind:<guid>}[…]`
  refs inside `Scene.text` (or any other rich-text body) are reader
  hints only — they do not put the character on stage, do not make
  them the speaker, do not affect any runtime state. Conditional
  logic on entities ("choice locked until X met") will live in a
  separate variable system later.

- **Slugs are unique per `(universe, kind)`.** GUID stays the
  immutable Firestore doc ID; `slug` is user-editable and free to
  rename, with "slug taken in this universe" validation in the form.
  Inline refs store the GUID, so renames never break existing text.
  Two universes may both have an `ingrid` character; one universe may
  have an `ingrid` character and an `ingrid` place.

- **Descriptive tags are not `EntityRef`s.** Genre / tone labels
  ("horror", "slow-burn", "canon-divergent") have no entity behind
  them. Keep as free strings (or a small standalone `Tag` kind if
  filtering demands it), excluded from the `${…}` picker.
  `Place.factions` stays descriptive.

- **`inGameDate` is free text everywhere.** Locale-numeric sorting
  works, but cross-story consistency is on the author. A canonical
  date type (era + year + optional time-of-day) would unblock real
  timeline rendering.

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
