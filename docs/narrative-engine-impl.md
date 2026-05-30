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
| Runtime     | Universe, Story, Character, Place, Event    | Product itself, participates in scene staging, or rendered in the reader |
| Structural  | Plotline                                    | Carries semantics prose can't (status, arc grouping, color)       |
| Lookup      | Codex — categorized (item, faction, race, religion, magic-system, …) | Pure reference cards: name, description, optional image, untyped `relatedRefs[]` |

Codex categories are author-defined labels, color-coded for
scan-ability. Pickers scope by category (insert "an item" → filter
category=item) so the unified store does not feel like a junk drawer.

**Lookup vs Structural vs Runtime is about role, not metadata presence.**
Codex categories describe the world; readers consult them. Plotline
groups timeline moments into arcs and carries its color and status as
framing chrome, but it never renders in the reader and never appears
in scene staging — it stays Structural. Event sits with Story and the
staging entities in Runtime: it anchors a timeline moment *and* renders
as a single-frame read with its own background, BGM, and forward
continuation, so it participates in both the timeline view and the
reader pipeline.

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

| Tier        | Where                                                                  | Purpose                          | Drives runtime? |
|-------------|------------------------------------------------------------------------|----------------------------------|-----------------|
| Runtime     | `Scene.characters` / `speaker` / `place`, end-of-content `Scene.nextRefs` and `Event.nextRefs` | Staging, placement, continuation | Yes             |
| Curatorial  | `Story.relatedRefs` / `Story.plotlineRefs`                             | Catalog & filtering              | No              |
| Factual     | `Event.relatedRefs` / `Event.plotlineRefs`, lookup-tier `relatedRefs`  | World-building                   | No              |
| Decorative  | Inline `${…}[…]` in any rich-text body                                 | Tooltip / hover                  | No              |

Codex refs appear in Curatorial, Factual, and Decorative tiers — never Runtime. Runtime staging is Character + Place only; runtime continuation is Story + Event, limited to the dedicated `nextRefs` slot.

**Picker scope per entity.** Timeline-tier entities (Story, Event) reference lookup-tier entities (Character, Place, Codex) for world-building; lookup-tier entities reference each other; nothing references timeline-tier through pickers — those relationships are encoded by `inGameDate` and (for arc grouping) by the dedicated `plotlineRefs` field.

| Entity                      | `relatedRefs` accepts   | `plotlineRefs`                    |
|-----------------------------|-------------------------|-----------------------------------|
| Story, Event                | character, place, codex | yes (`EntityRef<'plotline'>[]`)   |
| Character, Place, Codex     | character, place, codex | —                                 |
| Universe, Plotline          | —                       | —                                 |

- **No timeline-to-timeline picker refs for browsing.** Story↔Event and Event↔Event for "what happened nearby in time" are derivable from `inGameDate`; use Explore.
- **Continuation is the one runtime exception.** Story end-scenes and Events expose `nextRefs: EntityRef<'story' | 'event'>[]` for an authored "Continue reading" handoff. The schema keeps the array shape but the editors cap selection to one — branching is the scene graph's job, not `nextRefs`'. Authored intent, not date-derived adjacency.
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

## Explore UX

- **One date stream, refined client-side.** Explore runs a single global query against `_timelineEntries` — the interleaved story+event stream — with one cursor and one *Load more*. Type (all / stories / events), a single plotline, and free-text title search filter the loaded rows in the client rather than refetching. Default order is oldest-first (ascending in-game date).
- **Plotline filtering is client-side for now.** A selected plotline narrows the loaded rows by their `plotlineIds`; the server-side plotline filter and the swimlane projection it reads return with a `plotlineIds` array-contains index — see `backend-rules.md` *Timeline projections*.
- **Search is a loaded-rows filter.** Title search refines what's already paged in — a convenience over the visible stream, not a universe-wide find. The projection-backed picker search is the path that reaches every entity.

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

- **Layout switches the rendering shape.** `Scene.layout` ('dialog' |
  'showcase', default 'dialog') picks one of two presentation modes.
  Dialog renders the floating reader card with speaker + typewriter
  text + choices over the visual stage. Showcase suppresses the card
  and renders `scene.text` (if set) as a centered overlay caption —
  used for title intros, art beats, and any frame where the visual is
  the point. Both layouts share the same background and character
  stage; only the foreground UI differs.
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
- **Character facing flips the sprite horizontally.**
  `StagedCharacter.facing` ('left' | 'right') overrides a per-slot
  default rule: a `left`-slot character faces right, a `right`-slot
  character faces left, anything else faces right. The default lets
  authors stage characters without thinking about flips; the override
  covers exceptions (a left-slot character glancing offscreen). The
  field persists only when it disagrees with the slot default, so a
  position change still re-flows naturally. A `right` facing renders
  the sprite art as stored and a `left` facing mirrors it, so sprite
  art is expected to face right by default — the upload crop step's
  flip control normalizes orientation to that convention (see
  `media-rules.md`).
- **Scene constraints.** A given character may appear at most once in
  `characters[]`. Multiple characters in the same `position` are
  allowed; render order is `order` ascending, then insertion order.
  A speaker that is an `EntityRef<'character'>` not present in
  `characters[]` triggers a visible editor prompt rather than silently
  mutating the array.
- **Per-scene background mood filter.** `Scene.backgroundEffect`
  ('darken' | 'desaturate' | 'sepia' | 'cool' | 'warm', `undefined`
  for unaffected) applies a CSS filter to the background layer only —
  character sprites stay full-saturation so faces and silhouettes are
  never washed out by the scene's mood treatment.
- **Background asset resolution falls back to the story cover.** A
  scene without `backgroundAssetId` inherits `Story.coverAssetId`;
  with neither, the article shows its theme surface color. Lazy
  authors get a coherent visual identity without per-scene
  backgrounds; committed authors override per scene.
- **End-of-content continuation.** End-scenes (`scene.next.length ===
  0`) may carry `nextRefs: EntityRef<'story' | 'event'>[]`. The
  editors cap selection to one; the array shape is preserved for
  future flexibility. The reader renders `nextRefs[0]` (resolved via
  the directory cache) as a Continue anchor inside the floating card,
  labelled with the target's title. Restart and Back-to-catalog stay
  in the chrome. End-scene progress is retained in localStorage —
  only `Restart` clears it — so the reader can chain forward through
  the continuation and use the browser back button to revisit
  endings.
- **BGM is a separate concern from scene SFX.** `Story.bgmAssetId`
  declares the story-wide track. A scene may override with its own
  `bgmAssetId`, or force quiet with `bgmSilence: true`. The optional
  `bgmTransition` ('crossfade' | 'cut', default 'crossfade') controls
  how a change is performed on entry. `Scene.sfxAssetId` is the
  per-scene one-shot SFX / voice line slot; it plays simultaneously
  with the BGM and is authored from the `'sfx'` asset kind.
- **Authored text speed per scene.** Each scene carries an optional
  `textSpeed` ('slow' | 'normal' | 'fast' | 'instant', default 'fast'
  when unset). The reader collapses to instant when the user disables
  text animations in preferences *or* when the OS-level
  `prefers-reduced-motion` hint is set — either signal wins
  regardless of the authored value.
- **Per-scene entry transition.** `Scene.transition` ('crossfade' |
  'fade-through-black', `undefined` for an instant cut) plays as the
  reader enters the scene, with `Scene.transitionMs` setting the total
  duration (default 500 ms). Crossfade swaps the scene immediately and
  fades the foreground — characters and card — in over the
  independently-crossfading background; fade-through-black dips a black
  overlay to full, swaps the scene under cover, then lifts it. The
  transition is keyed off the *destination* scene, so it applies to
  both forward choices and Back navigation, and collapses to an instant
  cut under `prefers-reduced-motion`. Distinct from `bgmTransition`,
  which governs only the audio crossfade.

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
- **Catalog and Explore list views read metadata only.** Reader and
  editor read both via `StoriesService.getStoryWithContent()`.
- **Saves write both docs in a single transaction** with the version
  stamp on the metadata doc. Optimistic-concurrency contract uses the
  metadata's `version` field.
- **The `_content/main` subdoc inherits its parent's draft visibility**
  via a Firestore rule that reads the parent story's `draft` flag —
  drafts stay private to members; published content is public.
- **A fresh story is seeded with a title intro plus an opening scene.**
  `StoriesService.createDraftStory()` writes two scenes inside the
  same transaction as the metadata: a `showcase`-layout intro scene
  whose text is the placeholder title and whose `next` already points
  at a second empty dialog scene. `startSceneId` points at the intro.
  Authors edit, rewire, or delete either scene like any other; the
  seed is convenience, not enforcement. The intro inherits the story
  cover through the background fallback chain until the author picks
  a scene-level background.
- **Pattern reuse for future entities.** If a new entity ever carries a
  nested heavy payload that list views don't need, split it the same
  way (`{kind}/{id}/_content/main`). Today only Story qualifies — every
  other entity is a flat doc small enough to load whole.

## Event reading

- **Events render as a single frame in the same reader pipeline as
  stories.** The reader route `/reader/event/:id` loads an event via
  `EventsService.getById()` and hands it to `<app-scene-view>` in
  dialog layout: `event.description` becomes the card text,
  `event.coverAssetId` is the background (cropped via `object-cover`
  to fill whatever aspect the viewport offers), `event.bgmAssetId`
  drives a fresh `BgmController` instance, and `event.backgroundEffect`
  applies the same mood filter as on scenes.
- **No scene graph, no SFX, no localStorage progress.** Events are
  one frame; there's nothing to restart, nothing to resume to. The
  Continue anchor mirrors the story end-scene's: `event.nextRefs[0]`
  (editors cap to one) renders inside the card next to the
  description, while Back-to-catalog lives in the chrome. Restart is
  suppressed because the concept doesn't apply.
- **Long descriptions scroll inside the reading page.** The event
  reader's text sits in `.reader-card-page` — a centered, narrower
  panel capped at `78vh`; a description longer than that scrolls
  inside the panel. The editor surfaces a warning once
  `description.length > 600` so authors know the entry is getting
  long; the recommended path for longer prose is a one-scene story
  rather than a long event.
- **Inline-ref tokens resolve from `event.description`.** The reader
  parses `${kind:guid}[…]` exactly as it does for scene text, so
  events can hover-link characters, places, and codex entries the
  same way scenes do.

## Scene rendering layers

- **The article fills the available main area.** The reader page is
  a flex column inside `<main>`: header section + scene-view filling
  `flex-1` + optional end-of-content. Header and end-of-content sit
  in a centered `max-w-7xl` chrome column; the article escapes that
  column and spans edge-to-edge so the background dominates the
  visual field. There is no 16:9 article frame — the background
  `<img>` uses `object-cover` and crops on whichever dimension
  exceeds the viewport.
- **Background and foreground are separate layers inside the article.**
  The background sits in its own layer; the characters and the floating
  reader card (or showcase caption) share a foreground layer stacked
  above it. CSS filters applied to the background never reach the
  foreground, so characters stay at full saturation/sharpness and the
  visual hierarchy emerges automatically. Grouping the foreground also
  lets a crossfade transition fade characters and card in together over
  the background's own crossfade.
- **Character sprites stand on the article floor in a centered stage.**
  The character layer is a non-interactive box spanning the article;
  each staged sprite is absolutely positioned, anchored to the floor,
  and sized off stage height alone (`h-[88%]`, width following the
  art's aspect ratio) so window width never scales a sprite. Sprites
  snap to count-dependent centers — one sits at 50%, two at 30% and
  70%, three at 25% / 50% / 75% — so two characters always sit wider
  apart than three while the group stays centered. When the staged set
  changes, persisting sprites slide between layouts; a character joining
  or leaving the stage fades in or out (300 ms). The render keys each
  sprite on character id *and* sprite URL, so swapping one character's
  sprite (a neutral pose for an excited one) instead plays as a quick
  pop — the old pose is dropped at once while the new one grows in (a
  slight scale-in, 200 ms). The two cases are told apart at animation
  time: a
  leaving sprite whose character is still staged is a swap, otherwise a
  stage exit. When one scene change both repositions a sprite and swaps
  it, the swap is held until the slide settles (~300 ms) so a sprite
  never pops mid-move. A `ResizeObserver` watches the
  stage; when it is too narrow to hold every sprite at full height the
  lowest-priority non-speakers drop out rather than shrink — capacity is
  `floor(stageWidth / (stageHeight × 0.5))`, capped at three, and the
  speaker is always kept. Non-speakers ease to a partial grey (60%
  desaturation, slightly dimmed).
- **Floating reader card carries the dialog UI.** A solid, opaque
  card centered at the bottom of the article holds the speaker
  label, the typewriter body, and the choice list — choices live
  inside the card, not as a sibling below the article. The speaker
  label floats just above the card; its horizontal position mirrors
  the speaking character's sprite slot, mapped into the card's width.
  It slides to the new position when the speaker changes or that
  sprite moves, and fades only when it appears or disappears (a scene
  gaining or losing a speaker). A custom or off-stage speaker centers;
  a scene with no speaker shows no label. Card width is a CSS variable
  (`--reader-card-width`, default 60%) so the layout can be widened
  later without component changes. In showcase
  layout the card is suppressed; if the scene has text, it renders
  as a centered overlay caption with no card chrome and tap-anywhere
  advances when a single `next` is wired.
- **Sprites flip via `transform: scaleX(-1)` when facing left.** The
  facing flag is resolved per character through the slot-default
  rule plus the optional `StagedCharacter.facing` override. An
  un-flipped sprite is assumed to face right; that convention is
  enforced upstream by the upload crop step's flip control rather
  than trusted (see `media-rules.md`).
- **Background asset resolves through a fallback chain.**
  `scene.backgroundAssetId → story.coverAssetId → theme surface`.
  The reader's BG `<img>` slots crossfade between resolved URLs;
  identical URLs skip the swap so consecutive same-bg scenes don't
  flicker. A `blurDataUrl` paints immediately as a placeholder
  underneath the slots.
- **Per-scene mood filters apply to the background layer only.** The
  five `Scene.backgroundEffect` values map to CSS `filter` values on
  the background layer container, leaving characters untouched.
- **Scene transitions are orchestrated by the reader page.** On a
  `crossfade` scene the page swaps immediately and calls scene-view to
  fade its foreground layer in; on `fade-through-black` the page drives
  a black overlay above the article — black in, swap, black out.
  Navigation is serialized for the transition's duration so a second
  choice can't overlap an in-flight transition. A true double-buffered
  A↔B crossfade is intentionally out of scope.
- **Chrome idle-fades after 2.5s of pointer/key inactivity.** Title
  bar, back, preferences, and fullscreen controls fade to opacity 0
  and become non-interactive after no activity for 2.5 seconds. Any
  `pointermove`, `pointerdown`, or `keydown` instantly re-shows them
  with a 300ms ease-out. Chrome fade is reader-local state, not the
  app-wide `LayoutStore.chromeHidden` which still controls
  fullscreen behavior.
- **Audio lives in the reader shell as two hidden crossfade pairs.**
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
  reader's preferences (`bgmVolume`, `sfxVolume`). The reader-event
  page uses the same BGM controller pattern without the SFX pair.
- **Audio load is non-blocking.** Scene becomes readable when text and
  background are ready; audio joins late and fades in when available.
- **Loading indicators show progress, not a spinner, and appear only
  after 500ms of pending load.** First scene shows the loading state
  until its background is ready; subsequent transitions rely on
  preload.
- **Preload extends to reachable backgrounds, sprites, and audio.**
  `schedulePrefetch()` runs inside `requestIdleCallback`, walks the
  current scene's `next[]` choices, and hands the browser
  `<link rel="prefetch">` for any explicit `backgroundAssetId`,
  `sfxAssetId`, `bgmAssetId`, and `StagedCharacter.spriteId` on the
  target scenes. Skips entirely when `navigator.connection.saveData`
  is true or `effectiveType` is `slow-2g`/`2g`.
- **Text reveal honors the effective text speed.** The typewriter
  wraps each character behind a hidden span and reveals at the
  configured cps; `aria-live="polite"` on the card region announces
  the final text to screen readers. Clicking anywhere on the article
  frame mid-reveal completes the reveal instantly and absorbs the
  click so the same gesture doesn't also advance the scene. The
  effective speed collapses to instant when the reader has text
  animations disabled *or* when `prefers-reduced-motion` is set —
  either signal wins regardless of the authored value.

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
