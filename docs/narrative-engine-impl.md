# Narrative engine — implementation notes

Companion to `dev-improvements.md` §2 *Data-model coherence*. That section
sets the design (tiers, fields, surfaces); this file pins surface behavior
and rules for the parts that are not yet implemented.

Shipped pieces (PR1–PR5):

- `EntityRef<Kind>` and `EntityKind` live in `src/shared/models/`.
- Universe scoping (top-level `universes/{id}` collection, per-universe
  membership rules, universe-creator gating) lives in
  `src/features/universes/`, `firestore.rules`, and `storage.rules`.
- Slug uniqueness is enforced per `(universeId, kind)` via a
  `where('slug','==')` read-then-write check in each entity service.
- The resolved `Scene` shape (speaker union, `StagedCharacter[]`,
  `Scene.place`, free-string `position`) lives in
  `src/features/stories/data-access/story.types.ts`. Editor surfaces are
  in `scene-editor-panel.component.ts`.
- Character portraits with mood selection: `Character.portraits[]` (first
  entry is the default — reorder to change), `StagedCharacter.portraitId`,
  `CharacterAssetsService` for uploads, portrait library on the
  characters page, per-staged-character portrait selector in the scene
  editor, and a 3-column position grid in the player's `scene-view`
  with non-speaker dimming per §"Rendering pipeline" Layer 2/3.
- `storage.rules` mirrors `firestore.rules` — public read, member-only
  write under `universes/{universeId}/{allPaths=**}`, with a 25 MB
  upload size cap.
- Inline `${kind:<guid>}[Display Text]` references: `parseRefs` /
  `buildInlineRef` / `resolveRef` in `src/shared/utils/inline-refs.ts`,
  `<app-inline-ref-textarea>` in `src/shared/ui/inline-ref-textarea/`
  (caret-anchored popup, kind-prefix narrowing, fuzzy filter on
  name + slug, keyboard nav, mirror-div caret coords), wired into
  `Scene.text` (scene-editor-panel) and `Event.description`
  (event-form). Player rendering: `<app-inline-ref-text>` in
  `src/shared/ui/inline-ref-text/` — literals plain, resolved refs as
  `<a>` with `title=entity.name`, unresolved refs as plain
  `[Display Text]`. Editor still shows raw tokens; chip rendering and
  rich-text host promotion ship in PR6.

## Open optimization

- **Slug uniqueness atomicity.** Today's check is read-then-write — there's
  a small race window. A denormalized index doc
  (`universes/{id}/_slugIndex/{kind}_{slug}`) gives O(1) atomic checks at
  the cost of a second write per entity save. Either approach is fine for
  current scale.

## Resolved scene model — design rationale

Rules that need to outlive the type definition because they constrain
future PRs:

- **Speaker union.** `EntityRef<'character'>` for major characters (chip /
  hover-card / on-stage highlight), `string` for non-essential speakers
  (narrator, off-screen, inner thought, unnamed NPC), `undefined` for
  descriptive scenes with no speaker block. Multi-speaker is intentionally
  out of scope for v1; promoting to an array is backwards-compatible if a
  real use case appears.
- **Position is a free string, not an enum.** UI exposes `left | center |
  right` quick-select buttons; underlying schema accepts any slot ID, so
  future templates (`upper-left`, `background-row`, `far-left`, etc.) do
  not need a schema migration.
- **Scene constraints.** A given character may appear at most once in
  `characters[]`. Multiple characters in the same `position` are allowed;
  render order is `order` ascending, then insertion order. A speaker that
  is an `EntityRef<'character'>` not present in `characters[]` triggers a
  visible editor prompt rather than silently mutating the array.

## Inline reference token (PR5, shipped)

### Canonical form

```
${kind:<guid>}[Display Text]

${ch:9b1f3a…}[the hyur vampire]
${pl:7d2c81…}[Gridania]
${ev:4a09c7…}[the Calamity]
```

### Author-facing rendering (editor)

The editor never shows the raw token in normal use. A reference
renders as a chip displaying `slug + display text` with a hover
tooltip showing the entity's current name and slug. Raw
`${kind:<guid>}[…]` appears only:

- in JSON export,
- when the user explicitly toggles a "raw" view.

### Picker / autocomplete

- Trigger on `${`. With 0–1 chars after `${`, the popup matches names
  across all kinds in the active universe.
- Once `${ch` / `${pl` / `${ev` is typed, the list narrows to that
  kind and further input fuzzy-matches name and slug.
- Selecting inserts `${kind:<guid>}[]` and places the caret between
  the brackets so the author types the display text immediately.
- Popup scope: full active-universe collection for the kind. Story
  meta is not a filter; entries referenced elsewhere in the same
  story or scene rank first as a UX nicety.

### Resolution

- Player and catalog look up `(kind, id)` in the active universe; if
  resolved, render display text as a link with a hover-card.
- If the GUID does not resolve (entity deleted, story moved between
  universes), render `[Display Text]` as plain text. No crash, no
  fallback lookup in other universes.

## Rendering pipeline (player)

Forward-looking spec — layers 1 and 3 are partially shipped (background +
speaker label string); layers 2 (portraits) and 4 (inline refs) ship in
PR4.5 and PR5 respectively.

1. **Layer 1 — background:** render `Scene.background` if present.
2. **Layer 2 — staging:** render every entry in `Scene.characters` per
   its `position` and `order`. Default state is dimmed.
3. **Layer 3 — speaker highlight:** if `Scene.speaker` is an
   `EntityRef<'character'>` and that character is on stage, undim
   them. If `speaker` is a string, render it as a label without a
   portrait. If `speaker` is `undefined`, render no speaker block.
4. **Layer 4 — text:** render `Scene.text` with inline refs resolved
   to hover-cards.

## Edge cases

- **Missing reference:** render display text as plain. No cross-
  universe fallback.
- **Speaker not in `characters[]`:** editor warns and offers a
  one-click auto-stage action; never silently inserted.
- **Slug rename:** affects search and chip rendering only; stored
  tokens use GUIDs and do not need a rewrite.
- **Entity delete:** cascade-fix of inline refs is *not* attempted at
  delete time. Refs become unresolvable and render plain. A "find
  broken refs" maintenance tool can surface them later.
- **Story moved between universes:** every inline ref in its scenes
  becomes unresolvable in the destination universe. The editor offers
  a re-resolution pass before the move completes.

## Implementation plan — PR5 (inline refs, narrow)

Token grammar formalization, parser/resolver utilities, autocomplete UX
in the existing textarea hosts (`Scene.text`, `Event.description`), and
player rendering. Editor stays on `<textarea>` in this PR — author sees
raw tokens. **Acknowledged deviation from §"Author-facing rendering"**;
closed in PR6 when the WYSIWYG host lands. Two PRs in sequence keeps
each one reviewable; the UX wart of raw tokens is short-lived.

**Wiring:**

- `parseRefs(text)` returns
  `Array<{ literal: string } | { ref: EntityRef; displayText: string }>`.
  Single regex: `\$\{(ch|pl|ev|st):([A-Za-z0-9_-]+)\}\[([^\]]*)\]`.
- `resolveRef(ref, entities)` → entity name or undefined; consumers
  inject the relevant feature service.
- Autocomplete: caret-anchored popup on `${`. With 0–1 chars matches
  across all kinds; `${ch` / `${pl` / `${ev` / `${st` narrows to that
  kind. Fuzzy-filter on name + slug. Selection inserts canonical token
  and places caret between the brackets. Keyboard nav: Up / Down /
  Enter / Esc.
- Caret coordinate computation: mirroring trick — render a hidden
  `<div>` matching the textarea's font/size with the prefix text plus a
  zero-width marker; read its position. No external dependency.
- Player segment renderer: literal text plain, resolved refs as `<a>`
  with `title` set to the entity's current name (plain tooltip — full
  hover-card UX deferred), unresolved refs as plain `[Display Text]`.

**Out of scope (PR6 territory):**

- Chip rendering inside the input (WYSIWYG)
- Bold / italic / lists
- `Story.summary` / `Character.description` / `Place.description` hosts
- Hover-card UX

## Implementation plan — PR6 (rich-text host)

**Storage format:** markdown text with embedded `${kind:<guid>}[…]`
tokens, stored as plain string. Existing `Scene.text` /
`Event.description` / `Story.summary` (plain text) are valid markdown —
no data migration. Player's parser stays the same as PR5; markdown
rendering layered on top of the segment list.

**Library:** TipTap (ProseMirror-based). Headless, Angular-friendly,
extensible inline nodes for the entity-ref chip. Bundle cost ~50–80 KB
gzipped. Alternatives ruled out:

- **Quill** — Delta format adds export friction; harder to fit inline
  ref nodes that round-trip to markdown.
- **Toast UI** — markdown-first but heavier opinions, less extensible.
- **Raw `contenteditable`** — chip cursor logic too fragile for the
  time budget.

**Scope:**

- New `<app-rich-text-input>` in `src/shared/ui/`: bold / italic +
  unordered-list toolbar; the PR5 `${` autocomplete carried over as a
  TipTap suggestion plugin; custom inline node for entity refs that
  renders a chip and serializes to `${kind:<guid>}[Display Text]`.
- Markdown ↔ TipTap (de)serialization. Use `marked` for markdown
  parsing; hand-written extension for the token node.
- Hosts:
  - Swap `<textarea>` → `<app-rich-text-input>` in
    `scene-editor-panel` (`Scene.text`) and `event-form`
    (`Event.description`).
  - Promote `Story.summary` from `<textarea>` to rich-text input in
    `story-meta-panel`. Catalog card replaces `<p>{{ summary }}</p>`
    with a markdown-rendered output.
  - Add `Character.description?: string` (markdown) — input on
    `character-form`.
  - Add `Place.description?: string` (markdown) — input on `place-form`.

**Out of scope:** headings, blockquotes, code blocks, tables, external
link insertion via toolbar (raw markdown still parses), embedded media.

**Open questions to resolve at PR start:**

- HTML sanitization library — DOMPurify or marked's built-in guards.
- Whether SSR matters for the catalog markdown rendering or it stays
  client-side only.
