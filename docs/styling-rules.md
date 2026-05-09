# Styling rules

Two parts:
- **Rules** — standing constraints on how the design system, themes, and
  Tailwind utilities are used across the project.
- **Implementation** — open styling changes still to ship. Items are
  removed when shipped; this section is not a history.

Tailwind v4 is the styling layer. Components reference semantic tokens
defined in `src/styles.css` rather than raw slate/indigo/etc. utilities.
Themes are switched by toggling a class on `<html>`, which redefines the
token CSS variables.

---

# Rules

## Token system

All neutral surfaces and intent colors flow through CSS variables defined
in an `@theme` block in `src/styles.css`. Tailwind v4 generates utilities
from those tokens (`bg-surface`, `text-foreground`, `border-border`, etc.)
and the variables are overridden inside `.dark { ... }` (and any future
theme block). Components write light-mode utilities only — no `dark:`
sibling needed for token-based styling.

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
- **Special** — `overlay` (loading scrim), `backdrop` (dialog backdrop), `workspace` (node-editor canvas; sits one step below `surface` in both themes so nodes read as cards on top).
- **Tone palette** — identity hues for decorative chips and section handles: `tone-indigo`, `tone-emerald`, `tone-amber` each with a `-foreground` pair. Add tones here as new identity needs arise so a future theme can re-tune them centrally.

## How to write components

- Use semantic utilities: `class="bg-surface text-foreground border-border"`.
- For form inputs: `border-border-strong bg-surface text-foreground placeholder:text-foreground-faint focus:ring-accent-ring focus:border-accent`.
- For errors/warnings/success surfaces: `bg-warning text-warning-foreground border-warning-border` (and equivalents for `danger`/`success`).
- For accent surfaces (selection, focus, drag-over highlights): `bg-accent-soft text-accent-soft-foreground` for the soft variant; `bg-accent text-accent-foreground` for the strong (button-like) variant.
- For destructive buttons: `bg-danger-strong text-danger-strong-foreground hover:bg-danger-strong-hover active:bg-danger-strong-active focus-visible:ring-danger-strong-ring`.
- For class bindings, write a single binding per token:
  `[class.bg-accent-soft]="selected()"`. Don't pair light + `dark:` bindings.
- Don't write `bg-white dark:bg-slate-900` or any raw light/dark utility pair for neutral surfaces — use a token instead.

## Identity colors flow through the tone palette

Identity colors (entity kinds, app-tag tones, calendar section handles)
also live in `styles.css`, in the **Tone palette** at the bottom of each
theme block. Lookup files map their identity strings to tone-token
utility classes:

- `shared/utils/entity-kind-palette.ts` — entity kind chip / picker /
  inline-text ref classes per `EntityKind`. Character→indigo,
  place→emerald, event→amber, story→fuchsia, plotline→sky, codexEntry
  reuses the neutral surface/foreground tokens.
- `shared/ui/tag/tag.component.ts` — `TagTone` ('neutral' | 'amber' |
  'emerald' | 'sky' | 'indigo' | 'rose') maps to `bg-tone-{tone}
  text-tone-{tone}-foreground`. Neutral reuses `bg-surface-muted
  text-foreground-muted`.

Components write tone utilities (`bg-tone-indigo`,
`text-tone-amber-foreground`, …); `dark:` siblings are never needed.
A new theme retunes identity by overriding the tone tokens in its block.

## No `dark:` siblings in the codebase

Neutral surfaces and identity colors all flow through tokens. If you
catch yourself writing `bg-foo-50 dark:bg-foo-950/X`, define a token
(or reuse an existing tone) instead.

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

Open changes. Remove items as they ship.
