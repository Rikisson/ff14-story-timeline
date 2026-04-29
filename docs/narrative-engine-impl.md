# Narrative engine — implementation notes

Companion to `dev-improvements.md` §2 *Data-model coherence*. That section
sets the design (tiers, fields, surfaces); this file pins type shapes,
storage layout, picker behavior, edge cases, and migration steps for
whoever implements it.

## Core primitive

```ts
type EntityKind = 'character' | 'place' | 'event' | 'story' | 'scene';

interface EntityRef<K extends EntityKind = EntityKind> {
  kind: K;
  id: string; // Firestore doc ID (immutable GUID)
}
```

Carrying `kind` on the ref means resolution does not need a separate
GUID→kind index; the tag also makes raw JSON exports human-readable.

## Universe scope

Every Character, Place, Event, and Story belongs to exactly one
Universe. Switching the active universe switches every list, picker,
and inline-autocomplete source.

```ts
interface Universe {
  id: string;          // Firestore doc ID
  slug: string;        // globally unique
  name: string;
  description?: string;
  ownerUid: string;
  editorUids: string[];
  createdAt: number;
}
```

### Storage (subcollections)

```
universes/{universeId}
  /characters/{characterId}
  /places/{placeId}
  /events/{eventId}
  /stories/{storyId}
```

Stories continue to embed scenes as `Record<string, Scene>` for now —
universe scoping does not require changing that.

### Authorization

- **Reads:** universe doc and its subcollections are readable to
  members (owner + editors). A separate "publish to public" flag for
  stories is out of scope for v1.
- **Writes:** only the owner and editors of a universe can write into
  its subcollections. The existing per-entity `authorUid` becomes
  *informational* (original creator / last editor) — it no longer
  gates writes; universe membership does.
- **Universe creation:** gated by a Firebase custom claim
  (`universeCreator: true`). Long-term the claim is admin-granted.
  For dev bootstrap, set the claim on the developer account manually
  via Firebase Admin SDK so universe creation Just Works for that
  user; regular users see no "Create universe" affordance.

### Cross-universe references — forbidden

- Pickers and inline autocomplete only suggest entities from the
  active universe.
- An author who wants the same entity in two universes duplicates it
  (new GUID under the second universe; the slug can repeat because
  uniqueness is per-`(universe, kind)`).
- Moving a story between universes is a rare manual operation that
  invalidates every inline `${kind:<guid>}[…]` it contains; the editor
  surfaces a re-resolution pass against the destination universe.
  Treat as maintenance, not a routine action.

### Slug uniqueness check

Uniqueness scope: `(universeId, kind)`.

- On save, query the relevant subcollection with
  `where('slug', '==', <input>)` and reject if any other doc matches.
- Optional optimization: a denormalized index doc
  (`universes/{id}/_slugIndex/{kind}_{slug}`) gives O(1) checks at the
  cost of a second write per entity save. Either approach is fine for
  current scale.

## Resolved scene model

```ts
interface StagedCharacter {
  entity: EntityRef<'character'>;
  position: string;  // slot ID — UI presets `left` | `center` | `right`
  order?: number;    // resolves multiple characters in the same slot
}

interface Scene {
  text: string;                                       // rich text, hosts inline refs
  speaker?: EntityRef<'character'> | string;          // see speaker union
  characters: StagedCharacter[];                      // on-stage roster, authoritative
  place?: EntityRef<'place'>;                         // canonical world reference
  background?: string;                                // visual asset URL, independent
  audio?: string;
  position: { x: number; y: number };                 // canvas position in the editor
  next: Array<{ label?: string; sceneId: string }>;
}
```

### Speaker union

Three cases:

- `EntityRef<'character'>` — major character; renders with portrait /
  hover-card and is highlighted on stage if also in `characters[]`.
- `string` — non-essential speaker (narrator, off-screen voice, inner
  thought, unnamed NPC); renders as a plain label.
- `undefined` — descriptive scene with no speaker block.

Multi-speaker is intentionally out of scope for v1 — promoting to an
array is a backwards-compatible change later if a real use case
appears.

### Position

Stored as `string`, not an enum. UI exposes `left | center | right`
quick-select buttons but the underlying schema accepts any slot ID, so
future templates (`upper-left`, `background-row`, etc.) do not need a
schema migration.

### Scene constraints

- A given character may appear at most once in `characters[]`.
- Multiple characters in the same `position` slot are allowed; render
  order is `order` ascending, then insertion order.
- A speaker that is an `EntityRef<'character'>` not present in
  `characters[]` triggers a visible editor prompt ("Speaker not on
  stage — add?") rather than silently mutating the array.

## Inline reference token

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

## Migration

- CSV fields → typed pickers: `Story.mainCharacters`, `Story.places`,
  `Event.mainCharacters`, `Event.places`, `Scene.characters`. Existing
  string IDs in seed data convert directly to `EntityRef`.
- `Scene.speaker: string` → `EntityRef<'character'> | string`.
  Existing free-string speakers stay as the string branch; new picks
  use the ref branch.
- Add `Scene.place` (optional) without touching `background`.
- Add `Story.linkedEvents`, `Character.relatedCharacters`,
  `Character.description`, `Place.description` (all new optional
  fields).
- Promote `Story.summary` from plain string to rich text. The catalog
  card (`catalog-card.component.ts`) needs a rich-text renderer.
- Wrap every existing entity in a default Universe on first
  migration. The dev-bootstrap account creates one Universe; existing
  Characters / Places / Events / Stories are reparented under it.
  New entities are created under the active universe.
