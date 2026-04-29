# Narrative engine — implementation notes

Companion to `dev-improvements.md` §2 *Data-model coherence*. That section
sets the design (tiers, fields, surfaces); this file pins surface behavior
and rules for the parts that are not yet implemented.

Shipped pieces (PR1–PR4):

- `EntityRef<Kind>` and `EntityKind` live in `src/shared/models/`.
- Universe scoping (top-level `universes/{id}` collection, per-universe
  membership rules, universe-creator gating) lives in
  `src/features/universes/` and `firestore.rules`.
- Slug uniqueness is enforced per `(universeId, kind)` via a `where('slug','==')`
  read-then-write check in each entity service.
- The resolved `Scene` shape (speaker union, `StagedCharacter[]`,
  `Scene.place`, free-string `position`) lives in
  `src/features/stories/data-access/story.types.ts`. Editor surfaces are in
  `scene-editor-panel.component.ts`.

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

## Inline reference token (PR5, unshipped)

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
