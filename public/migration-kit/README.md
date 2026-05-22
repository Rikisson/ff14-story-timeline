# Universe Migration Kit

This kit lets you turn existing notes, a draft, or a finished story into a file the
app can import. It contains three files:

- **`universe.schema.json`** — the JSON Schema that defines the format.
- **`example-universe.json`** — a small, complete, valid example.
- **`README.md`** — this file.

## How to use it

1. Open a chat with any capable AI assistant.
2. Paste in `universe.schema.json`, `example-universe.json`, and the rules below.
3. Paste in your own material — notes, an outline, prose, a whole draft.
4. Ask it to produce a single `universe.json` that conforms to the schema.
5. In the app, open **Universe Settings → Import & Export**, choose the file, and
   review the dry-run report before importing.

The AI will not get everything right. That is expected — fix what the dry-run report
flags, adjust your prompt, and try again. The app validates strictly so you can
iterate quickly.

## The rules

**Slugs are the identity.** Every entity has a `slug`: lowercase letters, digits,
and hyphens, derived from its name (`Lyra Dawnwhisper` → `lyra-dawnwhisper`). A slug
must be unique within its kind. Reuse it verbatim everywhere that entity is
referenced — consistency of slugs is what stitches the world together.

**Never invent ids or timestamps.** Do not include `id`, `authorUid`, `createdAt`,
`updatedAt`, `version`, or similar. The app assigns those. If they appear they are
ignored.

**Two ways to reference another entity:**

- *Structured* — fields like `relatedRefs`, `plotlineRefs`, a scene's `speaker` or
  `place`: `{ "kind": "character", "ref": "lyra-dawnwhisper" }`.
- *Inline* — inside prose (`description`, scene `text`): `${prefix:slug}[Display Text]`.
  The display text is what the reader sees; the link resolves by slug.

  | prefix | kind        |
  |--------|-------------|
  | `ch`   | character   |
  | `pl`   | place       |
  | `ev`   | event       |
  | `st`   | story       |
  | `pt`   | plotline    |
  | `cx`   | codexEntry  |

  Example: `Knows ${ch:lyra-dawnwhisper}[Lyra] well.` Inline references are optional
  polish — plain prose is fine.

**The kinds:**

- `characters` — people. Name + description.
- `places` — locations. Name + description.
- `plotlines` — narrative arcs that group stories and events.
- `events` — dated world moments. A flat description, no scenes.
- `codexEntries` — encyclopedia entries; optionally filed under a category.
- `stories` — interactive scenes the reader plays through.

**Stories and scenes.** A story holds a map of scenes keyed by short strings you
choose (`arrival`, `the-gate`). `startScene` names the opening scene. Each scene's
`next` is a list of branches: one entry is a plain continuation, several entries
make a choice, an empty list is an ending. Keep stories **linear** (one `next` per
scene) unless branching choices are genuinely intended. Do **not** set scene
`position` — the app lays scenes out automatically.

**Calendar and categories.** If your world has its own chronology, define a
`calendar` (eras, months). Dated entities reference an era by its slug and a month
by its 1-based index. Codex categories are added to the universe if new.

**Media.** Omit the `assets` section and all art fields. Add images and audio in
the app after importing.

Study `example-universe.json` — it exercises every rule above.
