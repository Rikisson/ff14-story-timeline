# Styling rules

Tailwind v4 is the styling layer. Components reference semantic tokens defined in `src/styles.css` rather than raw palette utilities. Themes are switched by toggling a class on `<html>`, which redefines the token CSS variables.

---

# Rules

## Absolute rule: every system color is a token

**All system-provided color in the codebase flows through a token in
`src/styles.css`.** No raw Tailwind palette utilities (`bg-white`,
`text-slate-700`, `from-indigo-200`, `bg-amber-50/40`, …), no inline hex
literals, no `rgb(…)` / `rgba(…)` calls, no `dark:` siblings. If a
component needs a color, the right token already exists or you add one.

The single exception is **user-issued color stored in user data** —
values the end user typed (e.g., the color picker for a plotline or a
codex category). Those flow through `[style.color]` / `[style.background]`
bindings with a token-based fallback for the null case
(`p.color ?? 'var(--color-foreground-subtle)'`). Default values in seed
data and form pickers are user-facing palette choices, not design-system
chrome — those stay raw too.

Themes adapt by redefining the token values, not by adding utilities to
components. Adding a new theme is a single new selector block in
`styles.css`; no component needs to change.

## Token system

All tokens live in `src/styles.css`. Tailwind v4 generates utilities from
each token (`--color-foo` → `bg-foo`, `text-foo`, `border-foo`,
`ring-foo`, `from-foo`, `to-foo`, etc.).

The light `@theme` and dark `.dark` blocks are kept structurally
identical: every token defined in one is defined in the other, in the
same order, with the same group comments. When adding a token, add it to
both blocks at the same index so the file reads as two parallel columns.
A token that only makes sense in one theme is a smell — pick a value for
the other theme too, even if it's the same hex.

The token vocabulary:

- **Surfaces** — `canvas` (page bg), `surface` (cards/panels/dialogs),
  `surface-muted` (hover/badge), `surface-strong` (deeper hover),
  `surface-stronger` (active/pressed), `surface-subtle` (lightest hover).
- **Text** — `foreground` (primary), `foreground-muted` (body),
  `foreground-subtle` (labels), `foreground-faint` (hints/placeholders).
- **Borders** — `border` (panel borders), `border-strong` (input borders).
- **Roles** — `warning`, `danger`, `success` each expose a soft surface
  family: `{role}` (soft tinted bg), `{role}-foreground` (text/icon),
  `{role}-border` (border). `danger` additionally has a strong button
  family for destructive actions, mirroring `accent`: `danger-strong`
  (also the validation outline color), `danger-strong-hover`,
  `danger-strong-active`, `danger-strong-foreground`, `danger-strong-ring`.
- **Accent** — `accent` (button/strong), `accent-hover`, `accent-active`,
  `accent-foreground` (text on accent), `accent-ring` (focus ring),
  `accent-soft` (selection bg), `accent-soft-foreground`.
- **Special** — `overlay` (loading scrim over the page), `backdrop`
  (dialog backdrop), `workspace` (node-editor canvas; sits one step
  below `surface` in both themes), `scrim` + `scrim-foreground` (image
  scrim — the dark veneer over user-uploaded covers and the always-light
  text/UI that sits on top; applied with opacity modifiers like
  `bg-scrim/40` and `text-scrim-foreground/90`).
- **Tone palette** — identity hues for entity-kind chips, app-tag tones,
  and decorative section handles. Six tones (`tone-indigo`,
  `tone-emerald`, `tone-amber`, `tone-fuchsia`, `tone-sky`, `tone-rose`)
  each expose five facets:
  - `{tone}` — medium bg (tags, calendar handles, picker hover)
  - `{tone}-soft` — soft bg (kind UI chip, picker default, inline ref hover)
  - `{tone}-foreground` — readable text on either bg
  - `{tone}-foreground-strong` — emphasized text (picker)
  - `{tone}-border` — outline (picker)
  Slate-toned identity (codexEntry kind, neutral tag) reuses the
  surface/foreground/border tokens above instead of a dedicated tone.

## How to write components

Reach for the token family that names the role, never the palette. Form inputs always carry `border-border-strong`; role surfaces (`warning` / `danger` / `success`) use the matching `{role}` / `{role}-foreground` / `{role}-border` triplet; accent selection vs. accent button is the soft/strong split (`bg-accent-soft` vs. `bg-accent`); image scrims pair `bg-scrim/N` with `text-scrim-foreground`. For class bindings, write one binding per token (`[class.bg-accent-soft]="selected()"`) — never pair a light utility with a `dark:` sibling.

Two examples covering the awkward cases:

```html
<input class="border-border-strong bg-surface text-foreground placeholder:text-foreground-faint focus:ring-accent-ring focus:border-accent">

<button uiDanger>…</button>  <!-- prefer the directive over hand-rolling bg-danger-strong/hover/active/ring -->
```

## Button hierarchy

Four variants live in `shared/ui/button/`. Pick the one that matches the
button's role on the screen, not the noun on its label — "Add" can be
primary or secondary depending on what else is on the page.

- `uiPrimary` (filled accent) — the page's dominant action. The Add CTA
  on a list page (events, stories, characters), Save on a form or
  settings panel, Restart on the end screen. At most one Primary
  visible per region.
- `uiSecondary` (filled `surface-muted`) — a meaningful secondary action
  living next to a Primary, or a chrome-level action with no Primary
  competition. Add scene next to Save in the editor header, Add era /
  Add category next to Save in settings, Replace asset next to Remove,
  Sign in in the app header, Start over in the auto-resume reader
  aside.
- `uiGhost` (transparent) — tertiary, low-emphasis controls. Cancel in
  form footers, Reset, Edit on a card (paired with Delete), Remove for
  asset clearing (paired with Replace), View more pagination, header
  utilities like Copy UID / Sign out, catalog filter Reset.
- `uiDanger` (filled `danger-strong`) — destructive, irreversible
  actions. Delete on entity cards, Remove era / season / sprite /
  category / member, scene Delete in the editor.

All four directives match both `<button>` and `<a>` host elements. On
buttons the disabled input maps to the native `disabled` attribute; on
anchors it maps to `aria-disabled="true"` plus `tabindex="-1"`. The
custom Tailwind variant `inactive:` (defined in `styles.css`) targets
both forms, so disabled styling — `bg-surface-muted text-foreground-faint
border-border`, applied in the base directive — reads consistently
regardless of element or variant. Don't add per-button disabled
overrides.

## Identity colors flow through the tone palette

Lookup files map identity strings to tone-token utility classes — they
contain no raw colors, only token references:

- `shared/utils/entity-kind-palette.ts` — entity kind chip / picker /
  inline-text ref classes per `EntityKind`. Character→indigo,
  place→emerald, event→amber, story→fuchsia, plotline→sky. CodexEntry
  uses the neutral surface/foreground tokens directly.
- `shared/ui/tag/tag.component.ts` — `TagTone` ('neutral' | 'amber' |
  'emerald' | 'sky' | 'indigo' | 'rose') maps to `bg-tone-{tone}
  text-tone-{tone}-foreground`. Neutral uses `bg-surface-muted
  text-foreground-muted`.
- `features/calendar/feature/calendar-settings-panel.component.ts` —
  decorative section handles use `bg-tone-{indigo|emerald|amber}` plus
  the `-foreground` pair.

A new theme retunes identity by redefining the tone tokens in its
selector block. No component code changes.

## Typography

Three self-hosted families, each shipped as Latin + Cyrillic `woff2`
subsets so the app reads natively in English and Ukrainian. All three
are declared once in `@theme` and are theme-agnostic — they do not
change between light and dark.

- `--font-sans` (IBM Plex Sans) — the document default. Carries every
  UI control: navigation, forms, buttons, settings panels, pickers,
  catalog rows, and the reader's choice rows and chrome. Tailwind's
  `font-sans` utility and the base `body` rule both point at it.
- `--font-reading` (Source Serif 4) — the prose surface. Applied
  globally to `<app-typewriter-text>` (story scene text and event
  description) and `<app-markdown-text>` (every detail-card description
  and inline-ref hover popover), so the same humanist serif carries
  every authored prose surface. The reader's speaker chip rides on it
  too, so the name reads as part of the dialog it introduces. Designed
  for long-form on screen — comfortable across the reader's
  `0.9rem`–`1.3rem` font-size range.
- `--font-display` (Cormorant) — a high-contrast display serif, applied
  through the `font-display` utility to narrative-tier headings only:
  page titles (`text-3xl`), entity detail-card titles (`text-2xl`), and
  the editor's story title. It is frail at small sizes — never set it on
  body text, labels, or micro-headings. Functional surfaces (settings
  section dividers, form headers) live at `text-base` on `--font-sans`
  by design — the font follows the size tier, and tooling sits in the
  control-panel vocabulary rather than the documentary one.

The Opovid wordmark is the one piece of identity outside the token
families. `<app-brand>` (`shared/ui/brand/`) renders the name in
`--font-display` and follows `LocaleService`, so it shows "Opovid" in
the English UI and «Оповідь» in the Ukrainian one. The opening letter is
rubricated in `--color-brand-rubric`, a true theme token: a deep garnet
in light, lightened to a rose-garnet in dark so it keeps WCAG AA on the
dark canvas. That colour appears in the wordmark, the favicon, the
landing flourish, the reader's speaker chip — where the opening
letter of the speaker's name carries the same illuminated-capital
treatment — and as a 35%-opacity rule under each reader choice row to
bridge the sans-serif UI with the serif dialog above; and nowhere
else, so it never collides with the `danger` role. The book mark beside the name reuses `--color-accent` and
needs no token of its own.

## Detail cards

The six entity detail views — story, character, event, place, plotline,
codex entry — share `<app-detail-card>` (`shared/ui/detail-card/`): a
calm, left-aligned, scrollable text **panel** paired with the entity's
cover.

When the card is wide enough — a container query at `56rem` — and a
cover exists, the two sit side by side: the panel on the left over solid
`surface`, the cover filling a right-hand column whose share of the card
is the `--detail-cover-width` token (default `60%`). A horizontal
`surface`-to-transparent gradient veils the cover's inner edge so the
image dissolves into the panel's surface — a soft seam rather than a
hard border. Narrower cards, and cards with no cover, fall back to a
contained cover **banner** of fixed height above the panel (or the panel
alone). Either way the panel's position never depends on whether a cover
is present, so the layout doesn't jump.

The cover is staging, never a substrate for text: the gradient seam
lives in the gutter and the panel stays fully opaque, so no text is ever
laid over image pixels and contrast holds regardless of the uploaded
art. Titles render in `--font-display`; management actions are standard
button directives. The `scrim` token stays in use for timeline tiles,
which are small poster-thumbnails where a cover backdrop with text over
it is the right treatment.

## Reader

The reader carries a small layout vocabulary in `src/styles.css` that
keeps presentation knobs out of component code:

- `--reader-card-width` / `--reader-page-width` — widths of the two
  reader text panels: the story reader's floating card (default `60%`)
  and the event reader's centered reading page (default `42rem`).
  Override either at any scope to retune the layout without touching
  templates.
- `.reader-font-{small|medium|large|xl}` — applied to the reader root
  by `ReaderPreferencesService.fontSize`. Each class sets
  `--scene-font-size`, which the typewriter and floating card read.
- `.reader-bg-effect-{darken|desaturate|sepia|cool|warm}` — mood
  filters applied to the background layer when
  `Scene.backgroundEffect` is set. The filter sits on the layer
  container only; character sprites stay full-saturation.
- `.reader-card` — the reader text panel. Opaque `bg-surface`,
  `border-border`, soft shadow, `font-size: var(--scene-font-size)`.
  The story reader uses the default floating card,
  absolute-positioned at `bottom: 6%` of the article. The event
  reader adds `.reader-card-page`: vertically centered, narrower
  (`--reader-page-width`), capped at `78vh` with internal scroll so a
  long lore entry stays inside the panel.

Idle-fade chrome and the OS-level `prefers-reduced-motion` collapse
are driven by component-local signals, not CSS variables, so they
don't appear in the styling layer.

## Motion

`src/styles.css` defines a small duration scale — `--motion-fast`
(120ms), `--motion-base` (200ms), `--motion-slow` (300ms) — so the
hand-written CSS shares one rhythm for micro-interactions. Easing
keywords (`ease-out`, `ease-in-out`) stay inline at the call site. The
reader's longer, deliberately cinematic timings — scene crossfades and
the page enter/exit fades — are bespoke and stay out of the scale.

## Theme switching

- `ThemeService` (`shared/services/theme.service.ts`) holds the user's `'light' | 'dark' | 'system'` preference, persists it to `localStorage`, and toggles `.dark` on `<html>` via an effect.
- A pre-hydration script in `src/index.html` reads `localStorage.theme` and applies the class before Angular renders, so dark loads don't flash light.
- The toggle UI is `<app-theme-toggle>` in `shared/ui/theme-toggle/`. It cycles System → Light → Dark.
- The token block in `styles.css` is the single source of theme values. To add a third theme, add a new selector block (e.g. `.warm { ... }`) redefining the same variable names; component templates need no changes.

## Editor and Rete

- The editor surfaces (`features/editor/feature/editor.page.ts`, `features/editor/ui/scene-editor-panel.component.ts`, `features/editor/ui/story-meta-panel.component.ts`, `features/editor/ui/rete-canvas.component.ts`) style via CSS-in-styles blocks rather than utilities. Rules inside those blocks reference global tokens directly: `background: var(--color-surface); color: var(--color-foreground)`. No per-component `:host-context(.dark)` overrides — the global block does the work.
- The Rete plugin renders nodes/connections through component-encapsulated styles with build-hashed selectors (`[_nghost-XXX]`) that can't be reached from component CSS. Override Rete from `src/styles.css` using its stable host hooks: `[data-testid='node']` for the node container, `connection svg path` for connection lines, and `[data-testid='input-socket'] > *` / `[data-testid='output-socket'] > *` for the socket discs. These overrides reference tokens too, so they follow the active theme.

## Accessibility and contrast

- Tokens are tuned to maintain WCAG AA contrast in both light and dark. Don't substitute lower-contrast shades when adding a new theme.
- Form inputs always have a visible border (`border-border-strong`) — never rely on bg alone to delineate them.
- Focus rings always render against the canvas color via `focus-visible:ring-offset-canvas` (set in the button base). When adding new focus-able surfaces, keep this offset.

---

# Implementation

*(Empty — every shipped styling pass is reflected in the rules above.)*
