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

## Transfer a story, or write one?

Decide this before anything else, because it changes the whole job:

- **The material is already a finished story** — written prose, with its own
  narration and dialogue. **Transfer it faithfully.** Keep the author's exact
  wording, tense, and voice. Your only task is to *segment* the existing text into
  scenes. Do not rewrite it, do not summarise it, and do not shift it into a
  reporting register ("she has travelled to...", "the hero would often..."). If
  the source reads "Lyra drew her sword," the scene text reads "Lyra drew her
  sword."
- **The material is only notes, an outline, or pointers** — not actual prose.
  **Write the story.** Compose proper narrative scenes from the user's intent.

When it is not obvious which case you are in, ask the user.

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

### Stories and scenes

A story is played one scene at a time — the reader advances scene by scene — so
scenes are **small**. AI assistants get this wrong by default; follow every rule
below.

- **One beat per scene.** A scene is a single moment: one line of dialogue, or one
  short descriptive paragraph. Never pour a wall of text into a scene. If a passage
  runs long, split it across several scenes at natural beats — a new action, a new
  image, a shift of focus. Do not split mid-thought, and do not split single
  sentences just to split; only where there is a genuine beat.
- **A line of dialogue is its own scene.** When a character speaks, that line — with
  perhaps a short beat of action around it — is one scene. Do not stack several
  characters' lines into one scene; give each its own.
- **The first scene is a title card.** Make scene one a `showcase` scene whose
  `text` is just the story's title, with no staged characters. Its `next` leads into
  the real opening scene. This gives the reader a moment before the story begins.
- **`showcase` is for that title card only.** Every other scene omits `layout`, so
  it defaults to `dialog`. Do not scatter showcase scenes through the story.
- **`speaker` is for dialogue only.** Set `speaker` to a character reference only
  when the scene's text is that character speaking aloud. For narration and
  description, omit `speaker` entirely. Never use a `"Narrator"` label or any other
  stand-in name.
- A story holds a map of scenes keyed by short strings you choose (`title`,
  `the-gate`). `startScene` names the opening scene. Each scene's `next` is a list of
  branches: one entry is a plain continuation, several entries make a choice, an
  empty list is an ending. Keep stories **linear** (one `next` per scene) unless
  branching choices are genuinely intended. Do **not** set scene `position` — the
  app lays scenes out automatically.

### Calendar and categories

If your world has its own chronology, define a `calendar` (eras, months). Dated
entities reference an era by its slug and a month by its 1-based index. Codex
categories are added to the universe if new.

### Media

Omit the `assets` section and all art fields. Add images and audio in the app after
importing.

Study `example-universe.json` — its story models every scene rule above: a title
card, small one-beat scenes, dialogue lines split into their own scenes with a
`speaker`, and descriptive scenes with no `speaker` at all.
