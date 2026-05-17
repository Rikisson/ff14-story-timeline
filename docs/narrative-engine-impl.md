# Narrative engine — rules and implementation

Engine semantics — entities, references, scenes, calendar, and how a story is staged for a reader.

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

## References

References live on two surfaces — typed pickers and inline `${kind:<guid>}[…]` tokens — and fall into four semantic tiers. The picker UX is the same across tiers; the meanings are not.

| Tier        | Where                                                                  | Purpose             | Drives runtime? |
|-------------|------------------------------------------------------------------------|---------------------|-----------------|
| Runtime     | `Scene.characters` / `speaker` / `place`                               | Staging / placement | Yes             |
| Curatorial  | `Story.relatedRefs` / `Story.plotlineRefs`                             | Catalog & filtering | No              |
| Factual     | `Event.relatedRefs` / `Event.plotlineRefs`, lookup-tier `relatedRefs`  | World-building      | No              |
| Decorative  | Inline `${…}[…]` in any rich-text body                                 | Tooltip / hover     | No              |

Codex refs appear in Curatorial, Factual, and Decorative tiers — never Runtime. Runtime is Character + Place only.

**Picker scope per entity.** Timeline-tier entities (Story, Event) reference lookup-tier entities (Character, Place, Codex) for world-building; lookup-tier entities reference each other; nothing references timeline-tier through pickers — those relationships are encoded by `inGameDate` and (for arc grouping) by the dedicated `plotlineRefs` field.

| Entity                      | `relatedRefs` accepts   | `plotlineRefs`                    |
|-----------------------------|-------------------------|-----------------------------------|
| Story, Event                | character, place, codex | yes (`EntityRef<'plotline'>[]`)   |
| Character, Place, Codex     | character, place, codex | —                                 |
| Universe, Plotline          | —                       | —                                 |

- **No timeline-to-timeline picker refs.** Story↔Event and Event↔Event are derivable from `inGameDate`; use the timeline view.
- **No lookup-to-timeline picker refs.** A codex entry references an event or story through an inline `${event:…}` / `${story:…}` token in prose, not the picker.
- **`plotlineRefs` is the one structural exception.** Arc grouping isn't derivable from dates, so Story/Event carry it explicitly. Plotline itself doesn't store back-refs — membership lives on Story/Event.
- **Inline tokens accept all kinds** — they're decorative-tier and a separate surface from picker refs.

## Picker UX

Directory-backed pickers (related-ref pickers, plotline filter, inline-ref suggestion popup, codex category typeahead) share one interaction contract so they read consistently across the app:

- **Debounced search.** 150–200 ms between keystroke and Firestore query; the debounce timer resets on every keystroke.
- **Stale-response guard.** Each search has a sequence number; results that arrive after a newer query has fired are dropped, not rendered.
- **Selected chips resolve independently from the search result page.** A chip's label and avatar come from `EntityResolverCache` by ID, so chips stay rendered even when the current search query doesn't include them in its result set.
- **Explicit loading / no-results / error states.** A spinner during the in-flight query, a "no matches" empty state with the typed query echoed back, and a recoverable error state with a retry button — never a silently empty list.
- **Keyboard navigation and ARIA.** Arrow keys move the focus ring through results, Enter selects, Escape clears the query; results are announced via `aria-live` for screen readers; the input carries `aria-controls` pointing at the results list.
- **Draft badge for members.** Directory rows with `draft === true` render a small *Draft* pill alongside the entity label so members searching their own catalog see at a glance which results aren't visible to readers.
- **Category auto-create is affirmative.** See `Codex categories` *Every saved entry's `categoryKey` exists in config* — the typeahead surfaces *Create category "X"* as an explicit option, never creating silently.

Picker styling, the *Draft* pill, loading / empty / error states, the auto-create row, and the progress modals / toasts driven by the rebuild service all live under the standing tokens and component rules in `styling-rules.md`. Every visible string in the picker — placeholders, error copy, "no matches" empty state, *Create category "X"* affirmative, *Draft* pill — goes through Transloco per `i18n-rules.md`; nothing inline.

## Timeline UX

- **Per-lane pagination is the default.** When the user selects N plotline lanes in the filter, each lane fires its own query against `_timelineLaneEntries` with its own cursor, loading state, and error state. Each lane carries its own *Load more* button — there is no shared global "load more" across lanes.
- **No selected plotlines = one global query** against `_timelineEntries`, single cursor, single *Load more*. Switching from global to filtered (or adding/removing lanes) resets per-lane cursors; the existing pages aren't preserved across filter changes.
- **Unassigned lane.** When the filter selection includes the synthetic `__unassigned__` lane, it renders alongside selected plotline lanes with the same per-lane semantics.
- **Selected-lane cap.** See `backend-rules.md` *Cardinality limits* — the UI rejects selecting more than 10 lanes so concurrent query fan-out per pagination step stays bounded.

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
  - **Codex**: category label, resolved through `categoryKey` — live
    from the codex categories config on codex-only surfaces (the config
    is already hydrated there), or from the directory projection's
    denormalized `secondary` field on cross-kind surfaces (pickers,
    cross-kind list queries) that don't load the config.

## Inline-ref tokens

- **Token form:** `${kind:<guid>}[label]`. `kind` is one of
  `character | place | story | event | plotline | codex` — the
  parser-facing inline-token vocabulary. The `codex` prefix maps to
  EntityKind `codexEntry` through a single lookup table; every other
  prefix matches its EntityKind verbatim. Codex entries resolve their
  category at render time — the token does not encode category
  (no `${codex.item:…}`).
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
- **BGM is a separate concern from scene SFX.** `Story.bgmAssetId`
  declares the story-wide track. A scene may override with its own
  `bgmAssetId`, or force quiet with `bgmSilence: true`. The optional
  `bgmTransition` ('crossfade' | 'cut', default 'crossfade') controls
  how a change is performed on entry. `Scene.sfxAssetId` is the
  per-scene one-shot SFX / voice line slot; it plays simultaneously
  with the BGM and is authored from the `'sfx'` asset kind.
- **Authored text speed per scene.** Each scene carries an optional
  `textSpeed` ('slow' | 'normal' | 'fast' | 'instant', default 'fast'
  when unset). The reader may override authoring by disabling text
  animations in player preferences, in which case every scene renders
  instantly regardless of the authored value.

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
- **Config writes are last-writer-wins.** The calendar config doc has
  no `version` field — concurrent edits are rare in practice (the
  calendar settings save blocks behind a universe-scope projection
  rebuild, which serialises sessions naturally), so the OCC discipline
  the codex categories config carries isn't worth the complexity here.
  Add `version` if real contention surfaces.

## Codex categories

- **Per-universe config** at `universes/{u}/_meta/codex_categories`,
  managed via the Universe settings *Categories* section
  (`/universe/settings/categories`). Each entry:
  `{ id, key, label, color?, description? }` — `id` is a stable uuid,
  `key` is a stable folded slug derived from the initial label. Both
  are immutable after creation; `label`, `color`, and `description`
  may all change through the settings UI.
- **Config writes are transactional, not last-writer-wins.** The
  config doc carries a `version` field; create / rename / delete /
  auto-create all run through `runTransaction` (read config + validate
  uniqueness + apply change + bump version + write any dependent
  canonical/projection rows in the same transaction). Concurrent
  settings sessions retry on contention rather than silently
  overwriting each other.
- **Codex entries reference `categoryKey` only.** The canonical entry
  doc stores `categoryKey: string` and nothing else category-related.
  Chip color and the resolved label come from the categories config
  (already a single small doc per universe, always hydrated alongside
  the active universe). The directory projection's `secondary` field
  carries the denormalized label so cross-kind list queries don't
  need to join through the config — that's a projection-side
  denormalization, refreshed on category rename per
  `backend-rules.md` *Write discipline*.
- **Every saved entry's `categoryKey` exists in config.** A label that
  matches an existing entry case-insensitively snaps to that entry's
  `categoryKey` — no duplicate config rows from typing variations of
  the same name. A novel label surfaces an explicit *Create category
  "X"* option in the typeahead; selecting it commits the new config
  entry (uuid + folded key + entered label) immediately so the
  typeahead can reflect the selection, and the codex entry saves
  against it when the author submits the form. Creation is
  affirmative, never silent — typos don't become categories without
  the author confirming. The window between affirmative-create and
  form submit can leave a category with no referencing entry if the
  author abandons the form; that's an unused row, not a data
  integrity problem, and is recoverable via the unused-category
  sweep below — same shape as the orphaned-`categoryKey` repair.
- **Rename keeps identity.** Editing a category's label leaves `id`
  and `key` unchanged; existing entries' `categoryKey` stays valid
  and chip color is unaffected. No canonical entry doc needs
  rewriting — the rename is config-only — and the projection-side
  label refresh happens through the standard *Write discipline*
  category-rename trigger.
- **Delete requires reassignment.** The settings UI blocks delete
  while any codex entry references the category; the author either
  reassigns the entries or removes them first. The usage check is a
  non-transactional `where('categoryKey', '==', key)` query before
  the delete transaction commits — atomic enforcement client-side
  would need either a query-in-transaction (Firestore does not
  support) or a maintained per-category usage counter that every
  codex-entry write maintains. The v1 choice is the UI-only block: a
  codex entry created in the race window between the check and the
  delete commit ends up with a `categoryKey` pointing at nothing,
  the directory projection's `secondary` resolves to `undefined`,
  and the entry still renders plain — recoverable via the
  orphaned-categoryKey repair tool below.
- **Folded labels and keys are unique within the universe.** Creating
  or renaming a category whose label folds to a slug that already
  exists — either as another category's folded label or as a stable
  `key` from a prior label — is rejected by the settings UI. Collision
  validation runs inline on the label input as the author types, names
  the conflicting category in the error copy ("Conflicts with 'Items —
  Equipment'"), and gates the save button; the invariant is enforced
  again transactionally on save in case two sessions race. The
  invariant makes the typeahead auto-snap unambiguous: at any moment
  at most one category matches a given folded input. Authors who want
  visually-similar categories give them visually-distinct labels
  (e.g., "Items — Equipment", "Items — Consumables") so the folded
  forms differ.

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
- **Audio lives in the player shell as two hidden crossfade pairs.**
  Both pairs sit above `scene-view` so the elements survive scene
  re-renders, and both are driven imperatively by small controllers
  rather than declarative `[src]` bindings. The BGM pair loops: when
  consecutive scenes resolve to the same effective BGM URL the active
  slot keeps playing untouched; on change, the next slot fades in (or
  hard-swaps) per the scene's `bgmTransition`. The SFX pair is
  non-looping and treats every scene visit as "play this from the
  start" — a monotonic scene-entry counter passed alongside the URL
  distinguishes re-entries (including back-navigation onto the same
  asset), so the controller re-triggers the clip even when the URL is
  identical. SFX fades in (~220 ms) on scene entry and fades out over
  the same window on exit; mid-fade transitions cross over in
  parallel via the second slot. Volume on both pairs is bound to the
  reader's preferences (`bgmVolume`, `sfxVolume`).
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
- **Text reveal honors the scene's `textSpeed`.** Rendered through a
  typewriter component that wraps each character behind a hidden span
  and reveals them at the configured cps. Clicking anywhere on the
  article frame mid-reveal completes the reveal instantly and absorbs
  the click so the same gesture doesn't also advance the scene.
  Choices remain interactive throughout the reveal. The reader can
  disable the animation globally in player preferences.

---

# Implementation

## Test coverage

Specs exist for the editor and player stores plus a few utils. Services, route guards, and shared UI primitives are unverified — close that gap before the next major refactor pass.

## Repair tools

- **Orphaned `categoryKey` repair.** Walks `codexEntries` whose `categoryKey` no longer maps to a row in the `_meta/codex_categories` config (per *Codex categories — Delete requires reassignment*: the v1 UI-only delete block has a small race window where a concurrent create can produce one of these). Surfaces the affected entries and offers a reassign-to-category-X or clear-categoryKey flow.
- **Unused-category sweep.** Walks `_meta/codex_categories` for rows with zero referencing codex entries (per *Codex categories — Every saved entry's `categoryKey` exists in config*: the affirmative-create row commits the config entry before the codex entry is saved, so an abandoned form leaves an unreferenced category). Lists the unused categories and offers bulk delete.
- **Broken inline-ref repair.** Walks scenes for `${kind:guid}[…]` tokens whose target entity is missing (per *Inline-ref tokens — Entity delete*). Surfaces a list with the surrounding scene context and offers re-resolution or removal. Same shape as the categoryKey tool; consider sharing the UI shell.

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
- Pre-publish validation pass. The publish action surfaces a warning
  dialog when the story's metadata or content carries any of: inline
  refs pointing at missing entities, inline refs to draft / unpublished
  entities, broken `relatedRefs`, or `coverAssetId` / scene
  `backgroundAssetId` / `sfxAssetId` / `bgmAssetId` values pointing at
  deleted assets. Public render still hides non-public refs gracefully (plain
  text fallback per *Inline-ref tokens*); this surfaces the issue to
  the author before readers see the empty space.

## Platform

- Comments / reactions on stories.
- Achievements — endings discovered, hidden scenes found.
