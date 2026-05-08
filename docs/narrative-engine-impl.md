# Narrative engine — implementation notes

Pins the design rationale and edge-case behavior of the EntityRef
narrative engine. Constrains future PRs touching entity types, picker
UX, or inline `${kind:<guid>}` references.

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

| Tier        | Surface                                       | Purpose                | Drives runtime? |
|-------------|-----------------------------------------------|------------------------|-----------------|
| Curatorial  | Story-level fields                            | Catalog & filtering    | No              |
| Runtime     | `Scene.characters` / `speaker` / `place`      | Staging / placement    | Yes             |
| Factual     | `Event.*` refs, `Character.relatedCharacters` | World-building         | No              |
| Decorative  | Inline `${…}[…]` in any rich-text body        | Tooltip / hover-card   | No              |

Codex refs (`EntityRef<'codex'>`) appear in Curatorial, Factual, and
Decorative tiers. There is no codex-as-stage-actor — Runtime is
Character + Place only.

## Scope locks

- **Decorative tier is reader hints only.** Inline `${kind:<guid>}[…]`
  refs inside any rich-text body do not put characters on stage,
  do not make them the speaker, and do not affect runtime state.
  Conditional logic on entities ("choice locked until X met") is
  out of project scope.
- **Descriptive tags are not `EntityRef`s.** Genre / tone labels
  ("horror", "slow-burn", "canon-divergent") have no entity behind
  them — keep as free strings, excluded from the `${…}` picker.
  `Place.factions` stays descriptive strings; promote to codex refs
  only when a hover-card requirement is real, not anticipated.
- **Authoring velocity over schema purity.** A field that won't be
  reliably filled isn't queryable anyway — keep entity drafts small,
  push optional detail behind a drawer.

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

## Open optimization

- **Slug uniqueness atomicity.** Today's check is read-then-write — there's
  a small race window. A denormalized index doc
  (`universes/{id}/_slugIndex/{kind}_{slug}`) gives O(1) atomic checks at
  the cost of a second write per entity save. Either approach is fine for
  current scale.
