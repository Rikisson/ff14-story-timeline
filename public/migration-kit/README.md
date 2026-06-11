# Universe Migration Kit

Turn notes, a draft, or a finished story into a file this app can import. The kit is
three files:

- **`universe.schema.json`** — the JSON Schema for the import format.
- **`example-universe.json`** — a small, complete, valid example.
- **`README.md`** — this file.

## How to use it

1. Open a chat with a capable AI assistant.
2. Paste in `universe.schema.json`, `example-universe.json`, and this README.
3. Paste in your own material — notes, an outline, prose, a whole draft.
4. Ask for a single `universe.json` that conforms to the schema.
5. In the app: **Universe Settings → Import & Export**, choose the file, review the
   dry-run report, import.

Expect a few rounds. The app validates strictly and reports problems in plain
language — fix what it flags, adjust the prompt, try again.

## First: transfer, or write?

Decide this before anything else.

- **The source is already a finished story** — real prose, with its own narration
  and dialogue. **Transfer it.** Keep the author's exact wording, tense, and voice;
  your only job is to *segment* it into scenes. Never summarise it or shift it into
  a reporting register ("she had travelled...", "the hero would often..."). "Lyra
  drew her sword" stays "Lyra drew her sword."
- **The source is only notes, an outline, or pointers.** **Write the story** —
  compose proper scenes from the user's intent.

If it is not obvious which case you are in, ask.

## The format

**Slugs are identity.** Every entity has a `slug` — lowercase letters, digits, and
hyphens, derived from its name (`Lyra Dawnwhisper` → `lyra-dawnwhisper`), unique
within its kind. Every reference to that entity uses the exact same slug. Consistent
slugs are what hold the world together.

**Never invent system fields.** Omit `id`, `authorUid`, `createdAt`, `version`, and
the like — the app assigns them. If present, they are ignored.

**Reference entities two ways.** Structured fields — `relatedRefs`, a scene's
`speaker` or `place` — take an object: `{ "kind": "character", "ref": "lyra-dawnwhisper" }`.
Inside prose, link inline with `${prefix:slug}[Display Text]`, where the display text
is what the reader sees. The prefixes:

| prefix | kind       |
|--------|------------|
| `ch`   | character  |
| `pl`   | place      |
| `ev`   | event      |
| `st`   | story      |
| `pt`   | plotline   |
| `cx`   | codexEntry |

Inline references are optional polish; plain prose is fine.

**The kinds** are `characters`, `places`, `plotlines` (narrative arcs), `events`
(dated world moments, no scenes), `codexEntries` (encyclopedia entries), and
`stories` (interactive scenes). Pull all of them from the source — the people,
places, factions, and dated events a story mentions each deserve their own entity,
not just the story itself.

## Scenes

A story plays one scene at a time; the reader advances scene by scene. Scene sizing
is the thing AI assistants most often get wrong, in both directions.

**A scene is one beat** — one moment: a description, an action, or a character's turn
of speech. The reader takes in a whole scene at once, so each should land as a single
completed thought.

- **Don't crowd.** Never pack a long passage or several beats into one scene. Split
  it where the beat turns — a new action, a new image, a change of place, a change
  of speaker.
- **Don't fragment.** Don't make every sentence its own scene, and never split one
  sentence or one character's utterance across scenes. Sentences that carry a single
  continuous thought belong together — a completed thought reads better in one scene
  than across clicks.
- **A short scene is fine when it earns it.** A one-sentence — even one-word — scene
  works when the moment is a deliberate beat: a punchy line, a sharp turn. It is a
  judgment call about narrative weight, not a sentence count. Most beats run a few
  sentences; reach for a tiny scene only when the moment genuinely stands alone.

**Dialogue.** A character's whole turn of speech is one scene, with that character as
`speaker`; start a new scene when the speaker changes. Set `speaker` only for spoken
lines — omit it for narration and description, and never invent a `"Narrator"` label.

**The first scene is a title card** — a `showcase` scene whose `text` is just the
story's title, with no staged characters; its `next` leads into the real opening
scene. `showcase` is for this title card only; every other scene omits `layout`.

**Wiring.** Scenes are a map keyed by short strings you choose (`title`, `the-gate`).
`defaultEntryScene` names the scene readers start on. Each scene's `next` lists its
branches — one entry continues, several make a choice, an empty list ends the story.
Keep stories linear unless branching is genuinely intended. Never set `position`; the
app places scenes automatically.

**Entries.** A scene marked `"isEntry": true` is an additional doorway into the story:
connections from other stories or events may start the reader there instead of at the
`defaultEntryScene`. Most stories need no extra entries.

## Connections

`connections` are typed continuation edges between stories and events — "this ending
continues in that story/event". Each edge runs from a source ending (a story scene
with an empty `next`, or an event) to one target; **a source continues to at most one
target**, while any story or event can receive many inbound edges.

- Both endpoints must be entities **in this same package** — scene keys are local to
  the file and mean nothing against an already-imported universe.
- A story target may name an entry scene (`isEntry` or the `defaultEntryScene`); omit
  `scene` to use the default entry.
- `"to": null` is a *pending* hand-off — the ending is marked as continuing, but the
  target isn't written yet. Use `note` to say what comes next.
- `visibility: "reader"` shows the continuation to readers; `"editor"` keeps it as an
  authoring note.

## Calendar, categories, and media

If the world has its own chronology, define a `calendar` of eras and months; dated
entities name an era by slug and a month by 1-based index. Codex categories are added
to the universe if their key is new.

Omit the `assets` section and all art fields — add images and audio in the app after
importing.

Study `example-universe.json`: a title card, then short multi-sentence descriptive
beats with no `speaker`, then dialogue turns each in their own scene — plus a wired
connection chain (story → event → story at a named entry) and one pending hand-off.
It models every rule above.
