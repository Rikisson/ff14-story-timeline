# Narrative engine — rules and implementation

Two parts:
- **Rules** — standing constraints. The engine works this way; PRs that
  violate these need explicit justification.
- **Implementation** — open changes still to ship. Items are removed
  when shipped; this section is not a history.

---

# Rules

## Project scope

This is an **advanced interactive reader**, not a video game. Branching
endings via `Scene.next` are in scope; flags, inventory, reputation,
and other game-state variables are not. Entity design follows from
that constraint — entities serve reading and authoring, nothing else.

## Entity tiers

Entities fall into three tiers based on their *role*. The tier
determines whether they get their own type or live as a typed Codex
category.

| Tier        | Entities                                    | Why their own type                                                |
|-------------|---------------------------------------------|-------------------------------------------------------------------|
| Runtime     | Universe, Story, Character, Place           | Product itself, or participates in scene staging                  |
| Structural  | Event, Plotline                             | Carries semantics prose can't (date, status, arc grouping, color) |
| Lookup      | Codex — categorized (item, faction, race, religion, magic-system, …) | Pure reference cards: name, description, optional image, untyped `relatedRefs[]` |

Codex categories are author-defined labels, color-coded for
scan-ability. Pickers scope by category (insert "an item" → filter
category=item) so the unified store does not feel like a junk drawer.

**Lookup vs Structural is about role, not metadata presence.** Codex
categories describe the world; readers consult them. Event and Plotline
organize the timeline — Events anchor moments, Plotlines group those
moments into arcs. Plotline's color and status serve its structural
framing role; Plotline does not carry the descriptive weight that
Lookup-tier entities do, so it stays Structural even though it has no
`inGameDate` of its own.

**Promotion rule.** Promote a Codex category to its own entity only
when it gains one of:
- a runtime role (must appear in `Scene.*`),
- a structural semantic Codex prose can't express (a date, an arc
  status, a swimlane color),
- a structured relation that is reliably filled and queried.

Speculative future features do *not* justify promotion. Authoring
velocity over schema purity: optional fields nobody fills are worse
than absent fields, and a queryable shape is meaningless if the data
isn't there. Surface advanced fields behind a collapsible drawer
rather than a flat form.

## Reference tiers

References appear on two surfaces — typed pickers and inline
`${kind:<guid>}[…]` tokens — and fields fall into four semantic tiers.
The same picker UX serves all of them, but the meanings are not
interchangeable:

| Tier        | Surface                                                       | Purpose                | Drives runtime? |
|-------------|---------------------------------------------------------------|------------------------|-----------------|
| Curatorial  | `Story.relatedRefs` / `Story.plotlineRefs`                    | Catalog & filtering    | No              |
| Runtime     | `Scene.characters` / `speaker` / `place`                      | Staging / placement    | Yes             |
| Factual     | `Event.relatedRefs` / `Event.plotlineRefs`, lookup-tier `relatedRefs` | World-building | No              |
| Decorative  | Inline `${…}[…]` in any rich-text body                        | Tooltip / hover-card   | No              |

Codex refs (`EntityRef<'codex'>`) appear in Curatorial, Factual, and
Decorative tiers. There is no codex-as-stage-actor — Runtime is
Character + Place only.

## Reference topology

Picker scope per entity. The principle: timeline-tier entities
(Story, Event) reference lookup-tier entities (Character, Place,
Codex) for world-building; lookup-tier entities reference each
other for structural relationships; nothing references timeline-tier
through pickers — those relationships are encoded by `inGameDate`
and (for arc grouping) by the dedicated `plotlineRefs` field.

| Entity    | `relatedRefs` accepts            | `plotlineRefs` field |
|-----------|----------------------------------|----------------------|
| Universe  | —                                | —                    |
| Plotline  | —                                | —                    |
| Story     | character, place, codex          | yes (`EntityRef<'plotline'>[]`) |
| Event     | character, place, codex          | yes (`EntityRef<'plotline'>[]`) |
| Character | character, place, codex          | —                    |
| Place     | character, place, codex          | —                    |
| Codex     | character, place, codex          | —                    |

- **No timeline-to-timeline picker refs.** Story → Event, Event → Story,
  Event → Event are all derivable from `inGameDate`. Use the timeline view.
- **No lookup-to-timeline picker refs.** Codex entries that reference
  events/stories should do so through inline `${ev:…}` / `${st:…}`
  tokens in description prose, not via the picker.
- **`plotlineRefs` is the only timeline → timeline-adjacent picker we
  keep.** Plotline arc grouping is structural metadata that the
  timeline can't derive from dates alone, so Story/Event get a
  dedicated typed array. Plotline itself does not reference its members
  back — membership lives on Story/Event.
- **Inline `${kind:<guid>}` tokens** stay decorative-tier and accept
  all kinds — they are a separate surface from picker refs.

## Scope locks

- **Decorative tier is reader hints only.** Inline `${kind:<guid>}[…]`
  refs inside any rich-text body do not put characters on stage,
  do not make them the speaker, and do not affect runtime state.
  Conditional logic on entities ("choice locked until X met") is
  out of project scope.
- **Descriptive tags are not `EntityRef`s.** Genre / tone labels
  ("horror", "slow-burn", "canon-divergent") have no entity behind
  them — keep as free strings, excluded from the `${…}` picker.
- **Authoring velocity over schema purity.** A field that won't be
  reliably filled isn't queryable anyway — keep entity drafts small,
  push optional detail behind a drawer.
- **One descriptive prose field per entity, named `description`.**
  Catalog cards, hover popovers, and detail surfaces all read the same
  field and clip with `line-clamp-N`. No `summary` / `shortDescription`
  / `body` / per-aspect (personality, motivation, atmosphere)
  variants — authors do not reliably curate two prose surfaces, and
  consumer-side truncation is cheap.
- **List-pane secondary line is per-entity:**
  - **Character / Place**: first `relatedRefs` entry's resolved name —
    any kind. Author controls the slot by ordering relatedRefs in the
    picker.
  - **Story / Event**: formatted in-game date (resolved through the
    calendar config).
  - **Plotline**: capitalized `status` label.
  - **Codex**: `category` string.

## Inline-ref tokens

- **Token form:** `${kind:<guid>}[label]`. `kind` is one of
  `character | place | event | plotline | codex`. Codex entries
  resolve their category at render time — the token does not encode
  category (no `${codex.item:…}`).
- **Entity delete:** cascade-fix of inline refs is *not* attempted at
  delete time. Refs become unresolvable and render plain. A "find
  broken refs" maintenance tool can surface them later.
- **Story moved between universes:** every inline ref in its scenes
  becomes unresolvable in the destination universe. When a move-story
  flow lands, the editor should offer a re-resolution pass before the
  move completes.

## Resolved scene model

- **Speaker union.** `EntityRef<'character'>` for major characters
  (chip / hover-card / on-stage highlight), `string` for non-essential
  speakers (narrator, off-screen, inner thought, unnamed NPC),
  `undefined` for descriptive scenes with no speaker block.
  Multi-speaker is intentionally out of scope for v1; promoting to an
  array is backwards-compatible if a real use case appears.
- **Position is a free string, not an enum.** UI exposes `left | center
  | right` quick-select buttons; underlying schema accepts any slot ID,
  so future templates (`upper-left`, `background-row`, `far-left`,
  etc.) do not need a schema migration.
- **Scene constraints.** A given character may appear at most once in
  `characters[]`. Multiple characters in the same `position` are
  allowed; render order is `order` ascending, then insertion order.
  A speaker that is an `EntityRef<'character'>` not present in
  `characters[]` triggers a visible editor prompt rather than silently
  mutating the array.

## Calendar

- **Per-universe config** at `universes/{u}/_meta/calendar`, managed
  via the Universe settings *Calendar* section
  (`/universe/settings/calendar`). Three ordered lists: `eras`,
  `months`, and optional `weekdays`.
- **List order is the identity.** Era ordinal = array position. Month
  index = 1..N matching array position. Weekday index 0 = the first
  weekday — the anchor for cycle derivation. To re-anchor the week,
  reorder the list.
- **Era reset flag.** `CalendarEra.resetsWeek` declares "day 1 of this
  era falls on the first weekday." Use it when a preceding era is
  open-ended (`maxYears` unset), so dates after the cut-over still
  derive a weekday.
- **Weekday derivation.** For a date with year/month/day, weekday
  index = `(daysSinceAnchor) mod weekdays.length`. The anchor is the
  most recent era at-or-before the date that is `resetsWeek` or is
  the first era. If a non-reset preceding era has no `maxYears`, the
  count is unknowable and derivation returns null — the date renders
  without a weekday silently.
- **Display.** `formatInGameDate(d, { eraName, monthName, weekdayName })`
  in `@shared/utils` is the single surface for rendering an in-game
  date. It honors `d.display` as an explicit author override; otherwise
  composes prose like *"Lightning Day — 15 Spring of 1577, Sixth
  Astral Era — 13:45:30"*. Time cascades hour → minute → second;
  trailing parts drop when an earlier component is missing. The input
  form flags minute-without-hour and second-without-minute as
  validation errors so the data the formatter sees is well-formed.

## Codex categories

- **Per-universe config** at `universes/{u}/_meta/codex_categories`,
  managed via the Universe settings *Categories* section (`/universe/settings/categories`). Each entry:
  `{ id, label, color?, description? }`.
- **Codex chip color** resolves through this config via
  case-insensitive lookup on the entry's `category` string. Entries
  whose category isn't in the config render with the default chip
  styling.
- **Codex form snaps to canonical labels** on save. When the typed
  category matches an existing config label case-insensitively, the
  stored string is replaced with the canonical label. New strings pass
  through as free-form categories — authors aren't blocked from
  creating ad-hoc categories that aren't in the config yet.
- **No uniqueness validation** in the constructor. Duplicate labels are
  the author's responsibility; the visible card grid makes them easy to
  spot.

## Locale

- **Per-universe declaration.** `Universe.locale: 'en' | 'uk'` records
  the language the author writes prose in. Required; new universes
  prefill from the active UI locale, legacy documents default to `en`.
- **Authored prose follows this locale.** Story scenes, character /
  place / event / codex descriptions, story summaries, scene speaker
  strings — every authored-text surface tags `[attr.lang]` with this
  value so screen readers and translators see the boundary.
- **UI chrome locale is independent.** A reader on the Ukrainian UI
  may be reading an English-authored universe; the surrounding panel,
  buttons, and metadata chips translate, the prose does not. UI
  translation rules live in `i18n-rules.md`.
- **Switching the universe locale does not migrate prose.** Re-typing
  is the author's responsibility; the picker in *Universe settings →
  General* simply changes the field.
- **Calendar prose follows the universe locale.** Era names, month
  names, and weekday names entered in the universe calendar config are
  authored data — they render in the universe's locale, not the UI
  locale.

## Story persistence

- **Story metadata and content live in separate Firestore documents.**
  Metadata (slug, title, description, refs, lifecycle) at
  `universes/{u}/stories/{sid}`; content (`startSceneId`, `scenes`) at
  `universes/{u}/stories/{sid}/_content/main`.
- **Catalog and timeline list views read metadata only.** Player and
  editor read both via `StoriesService.getStoryWithContent()`.
- **Saves write both docs in a single transaction** with the version
  stamp on the metadata doc. Optimistic-concurrency contract uses the
  metadata's `version` field.
- **The `_content/main` subdoc inherits its parent's draft visibility**
  via a Firestore rule that reads the parent story's `draft` flag —
  drafts stay private to members; published content is public.
- **Pattern reuse for future entities.** If a new entity ever carries a
  nested heavy payload that list views don't need, split it the same
  way (`{kind}/{id}/_content/main`). Today only Story qualifies — every
  other entity is a flat doc small enough to load whole.

## Scene rendering layers

- **Three independent DOM layers.** Background, characters, and
  text-scrim are siblings, not nested. CSS filters applied to the
  background must not affect characters; characters stay at full
  saturation/sharpness so the visual hierarchy emerges automatically.
- **Text scrim is the engine's job.** A gradient overlay between the
  character layer and text guarantees readability across any
  background. Not the author's responsibility.
- **Audio element lives in the player shell.** The `<audio>` host
  sits above `scene-view` so it survives scene re-renders. Cross-scene
  ambient continuity depends on this.
- **Background swaps use two stacked `<img>` elements with CSS opacity
  crossfade.** Skip the crossfade when the next asset URL equals the
  current.
- **Image rendering uses `blurDataUrl` as an immediate placeholder.**
  Full image fades in on load.
- **Audio load is non-blocking.** Scene becomes readable when text and
  background are ready; audio joins late and fades in when available.
- **Loading indicators show progress, not a spinner, and appear only
  after 500ms of pending load.** First scene shows the loading state
  until its background is ready; subsequent transitions rely on
  preload.

---

# Implementation

Open changes. Remove items as they ship.

## Tech debt

- Restrict the Firebase API key to the GitHub Pages domain (Cloud
  Console).
- Server-side list filtering — composite indexes per filter
  combination so tight filters don't depend on "View more" thrash
  through client-side filtering of the loaded page.
- Test coverage for services, guards, and components (specs exist for
  editor and player stores).
- Atomic slug uniqueness via denormalized index doc
  (`universes/{id}/_slugIndex/{kind}_{slug}`); current check is
  read-then-write.

## Player

- Multiple save slots per story; cloud sync.
- Reading-progress badges ("In progress" / "Completed" / "Endings
  N/M").
- Player preferences — text speed, font size, BGM volume; persisted.
- Layered audio — BGM track + per-scene SFX/voice line.
- PWA / offline reading — manifest + service worker.

## Catalog

- Tags & genres with tag-based filtering.
- Full-text search across stories, characters, places, events.
- Sort by recency / popularity / length.
- Story collections / series — explicit ordering across multiple
  stories.
- Public author profile pages.

## World-building

- Standalone detail pages for Characters, Places, Events (today they
  surface only inside list-pane).
- Map view of places — store lat/lon, render with leaflet/maplibre.
- Relationship graph — Rete is already in the bundle; reuse it.

## Editor

- Auto-save with conflict resolution.
- Revision history / undo-redo via `revisions/` subcollection.
- Story templates ("Linear", "Branching with reunion", "VN skeleton").
- AI-assisted scene drafting via Claude API.
- Co-authoring — Firestore presence + multi-cursor.
- Import / export (JSON).
- Print / PDF export of a story walkthrough.

## Platform

- Comments / reactions on stories.
- Achievements — endings discovered, hidden scenes found.
