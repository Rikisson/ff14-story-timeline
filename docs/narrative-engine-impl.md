# Narrative engine — implementation notes

Companion to `dev-improvements.md` §2 *Data-model coherence*. That
section sets the design (tiers, fields, surfaces); this file pins
design rationale and edge-case behavior that constrain future PRs.

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

## Inline-ref edge cases (forward-looking)

- **Entity delete:** cascade-fix of inline refs is *not* attempted at
  delete time. Refs become unresolvable and render plain. A "find
  broken refs" maintenance tool can surface them later.
- **Story moved between universes:** every inline ref in its scenes
  becomes unresolvable in the destination universe. When a move-story
  flow lands, the editor should offer a re-resolution pass before the
  move completes.
