# i18n rules

Two parts:
- **Rules** — standing constraints on how UI strings are translated,
  how locale state flows, and how authored prose is tagged.
- **Implementation** — open i18n changes still to ship. Items are
  removed when shipped; this section is not a history.

The library is `@jsverse/transloco`. Strings live in JSON, loaded at
runtime; one bundle ships both locales.

---

# Rules

## Scope

i18n covers **UI chrome only** — buttons, form labels, empty states,
validation text, tooltips, command names, dialog titles. **Authored
content is data**: story prose, character / place / event / codex
descriptions, scene text, entity names. Authored content carries the
universe's locale on the entity tree, never through transloco.

UI locale and content locale are independent. A reader on the Ukrainian
UI may be reading an English-authored universe; the chrome translates,
the prose does not.

## Library

- `@jsverse/transloco` for translation lookup.
- `@jsverse/transloco-messageformat` for ICU plurals and selects.
- No other i18n library — `@angular/localize` is not used.

## Locales

- Supported: `en` (default), `uk`.
- Initial UI locale: `localStorage.uiLocale` → first matching
  `navigator.languages` entry → `en`.
- The user's choice writes back to `localStorage.uiLocale` through the
  same service that calls `TranslocoService.setActiveLang`.
- `LOCALE_ID` mirrors the active transloco language so Angular's
  `DatePipe` / `DecimalPipe` follow.

## File layout

- Global chrome (used in 3+ feature scopes): `public/i18n/{en,uk}.json`,
  the default loader URL.
- Per-feature scope files: `src/features/{x}/i18n/{en,uk}.json`,
  registered with `provideTranslocoScope({ scope: 'x', loader })` on the
  feature's lazy route. The scope name matches the feature folder,
  singularized.
- Callers reference scoped keys as `x.group.key` after registration.

## Key shape

- Pattern: `<scope>.<group>.<key>` or `<scope>.<key>`. Maximum three
  levels.
- **Scope**: feature/concept name, singular camelCase. Current scopes:
  `general`, `auth`, `character`, `place`, `story`, `event`, `plotline`,
  `codex`, `editor`, `timeline`, `player`, `universe`, `calendar`,
  `era`, `media`.
- **Group** *(optional)*: pick what the scope actually needs from
  `actions`, `fields`, `empty`, `messages`, `tooltips`, `validation`,
  `enums`. Don't force three pre-set groups; a small scope can sit
  flat (`general.loading`, `auth.signOut`).
- **Key**: camelCase, descriptive, self-documenting.

## What goes where

| String kind                                                     | Group        |
|-----------------------------------------------------------------|--------------|
| Buttons, menu items, command names, link text                   | `actions`    |
| Form field labels, table headers, filter chips, dropdown labels | `fields`     |
| Empty-state copy, search placeholders, hint text                | `empty`      |
| Toasts, dialog bodies, success/error feedback, loading states   | `messages`   |
| Hover tooltips, ARIA hints, keyboard chips                      | `tooltips`   |
| Reactive Forms validator messages                               | `validation` |
| App-defined enum value labels (plotline status, scene position) | `enums`      |

Author-defined enum values (codex categories, era names, plotline
labels) are *data*, not i18n — they live on per-universe config docs.

## Validation strings

- **Generic validators** (`required`, `email`, `minLength`, `maxLength`,
  `pattern`) live at `general.validation.*`. A shared validator-message
  resolver reads from there so any Reactive Form picks them up.
- **Field-specific validation** (e.g. *"A character with this name
  already exists in {{universe}}"*) lives in the relevant scope's
  `validation` group.

## `general` promotion

Promote a string to `general` when at least three feature scopes need
it. Until then, keep it scope-local. Promotion is one-way for chrome
strings; a key removed from `general` because only one scope still uses
it should move into that scope, not be deleted.

## Numbers, dates, plurals

- `DecimalPipe` / `CurrencyPipe` / `DatePipe` read `LOCALE_ID`, which
  mirrors the active UI locale. A Ukrainian user sees Ukrainian
  formatting automatically — no per-call locale arguments.
- In-game dates use `formatInGameDate` (see narrative-engine-impl
  *Calendar*); era and month names come from the universe's calendar
  config and follow the **content** locale, not the UI locale.
- Plurals and selects use ICU MessageFormat. Never concatenate
  translated fragments around a value.

## Universe.locale

- `Universe.locale: 'en' | 'uk'` declares the language the author
  writes prose in. Required field; new universes prefill from the
  active UI locale; legacy documents default to `en`.
- The universe settings *General* section exposes a locale picker.
  Switching the value does not migrate existing prose — the author
  rewrites or accepts mixed-locale content.

## Content language tagging

Any element whose visible text is authored prose binds `lang` to the
universe's locale: `<div [attr.lang]="universe().locale">`.

- Scene background prose, scene speaker text, entity descriptions,
  codex bodies, story summaries — all wrap in a content boundary that
  carries `lang`.
- Tiptap-rendered output sets `lang` on its host wrapper, not on every
  paragraph.
- Chrome surrounding the content (panel header, edit button, metadata
  chips) inherits the document `lang` from the active UI locale via
  `<html lang>`.
- Default screen-reader voice follows `<html lang>`, so chrome reads in
  the UI locale; content blocks pivot through their own `lang`
  attribute.

## Locale switching

- The UI toggle lives in the user dropdown next to the theme toggle;
  cycles `EN ↔ UK`.
- Switching is synchronous from the user's perspective — no reload.
  Transloco swaps the active language; the `LOCALE_ID` factory
  re-resolves on the next change-detection tick.
- Content locale never changes via the toggle; it is whatever the
  active universe declares.

## Third-party UI strings

- **Tiptap** — toolbar tooltips and bubble-menu commands route through
  transloco at the integration component, under `editor.tiptap.*`.
- **Rete** — node and socket labels are authored by us; they translate
  at the rendering layer under `editor.rete.*`.
- **Firebase Auth** — error codes pass through a thin translator that
  maps to `auth.messages.*`. We never display the SDK's English strings
  directly.

## SSR

The server picks the initial locale from the request `Accept-Language`
header before rendering, so the prerendered HTML doesn't flash a
default-locale layout. The same logic re-runs on hydration, reading
`localStorage` first; the server choice only sticks on first visits.

## Example

A trimmed `public/i18n/en.json`:

```json
{
  "general": {
    "actions": { "save": "Save", "cancel": "Cancel", "delete": "Delete" },
    "fields": { "name": "Name", "status": "Status" },
    "messages": { "loading": "Loading…", "saveSuccess": "Saved" },
    "validation": {
      "required": "This field is required",
      "email": "Enter a valid email",
      "minLength": "Must be at least {{ min }} characters"
    }
  },
  "auth": {
    "actions": { "signIn": "Sign in", "signOut": "Sign out" },
    "fields": { "email": "Email", "password": "Password" },
    "messages": { "signInError": "Sign-in failed: {{ reason }}" }
  }
}
```

A scoped feature file at `src/features/character/i18n/en.json` (no
scope prefix inside the file — the prefix comes from registration):

```json
{
  "actions": { "create": "New character", "edit": "Edit character" },
  "fields": { "name": "Name", "appearance": "Appearance" },
  "empty": {
    "list": "This universe has no characters yet.",
    "search": "No characters match \"{{ query }}\"."
  },
  "validation": {
    "nameUnique": "A character with this name already exists in {{ universe }}."
  }
}
```

## For AI assistants

When adding or refactoring translations:

1. UI string → translate. Authored prose → entity field, never a
   translation key.
2. Pick the smallest scope the string belongs to. Promote to `general`
   only when three scopes share it.
3. camelCase keys, max three levels (`scope.group.key`), no deeper
   nesting.
4. Cross-cutting validator messages live at `general.validation.*`;
   field-specific validation goes in the scope's `validation` group.
5. ICU MessageFormat for plurals and selects. Never concatenate
   translated fragments.
6. New content-prose surfaces wrap in `[attr.lang]="universe().locale"`.
7. Add keys to **both** `en.json` and `uk.json` in the same change.
   The Ukrainian value can be a TODO marker (`"⟦TODO⟧ Save"`) when no
   translation is ready, but the key must exist in both files so
   missing-key warnings stay clean.

---

# Implementation

Open changes. Remove items as they ship.

## Library wiring

- Install `@jsverse/transloco` and `@jsverse/transloco-messageformat`.
- `provideTransloco` in `app.config.ts` with
  `availableLangs: ['en', 'uk']`, `defaultLang: 'en'`,
  `reRenderOnLangChange: true`, `prodMode: !isDevMode()`.
- `TranslocoHttpLoader` reads `/i18n/{lang}.json`. Matching factory
  for `provideTranslocoScope` resolves
  `/i18n/{scope}/{lang}.json` for feature scopes (or sibling
  `i18n/{lang}.json` files inside each feature folder, served via
  Angular's asset graph).
- Register Ukrainian locale data via
  `registerLocaleData(localeUk, 'uk')` at bootstrap so `DatePipe` /
  `DecimalPipe` recognize the locale.
- `LOCALE_ID` factory bound to `TranslocoService.langChanges$`.

## SSR

- Server-side resolver reads `Accept-Language`, calls
  `setDefaultLang` + `setActiveLang` before initial render.
- Client-side hydration prefers `localStorage.uiLocale`; falls back
  to whatever the server picked.

## Locale switching

- `LocaleService` (`shared/services/locale.service.ts`) — signal-backed
  active locale, persists to `localStorage.uiLocale`, calls into
  transloco, drives the `LOCALE_ID` factory.
- `<app-locale-toggle>` in `shared/ui/locale-toggle/` — sibling of
  `<app-theme-toggle>` in the user dropdown.
- `<html lang>` bound to the active UI locale via `LocaleService`
  (mirrors how `ThemeService` toggles `.dark`).

## Seed translation files

- `public/i18n/{en,uk}.json` with the `general` scope populated:
  actions (save / cancel / confirm / delete / edit), fields (name /
  status), messages (loading / saveSuccess / saveError), validation
  (required / email / minLength / maxLength / pattern).
- Per-feature `en.json` + `uk.json` skeletons created as each feature
  is wired through transloco.

## Migration

Replace hardcoded English in templates and TS feature-by-feature, in
this order:

1. `auth` (smallest surface, exercises the wiring end-to-end).
2. `general` shared widgets (button labels, dialog chrome).
3. `catalog` and `timeline` (read-only consumer surfaces).
4. `editor` and `player` (largest surfaces, prove the scope-loading
   pattern).
5. Entity feature folders (`character`, `place`, `event`, `plotline`,
   `story`, `codex`, `universe`, `calendar`, `era`, `media`).

Validator-message resolver lives at `shared/utils/form-validation.ts`
and reads `general.validation.*`, so existing Reactive Forms surface
translated errors without per-form wiring after migration.

## Universe.locale

- Add `locale: 'en' | 'uk'` to the Universe schema (see
  `narrative-engine-impl.md` *Locale*).
- Universe settings *General* section: locale picker with explanatory
  copy that prose is not migrated on switch.
- Universe creation flow: prefill with the active UI locale.
- One-shot Firestore migration stamps `locale: 'en'` on every existing
  universe document missing the field.

## Content language tagging

Wrap each authored-prose surface in `[attr.lang]` bound to the
universe's locale:

- Scene-view text layers (background prose, speaker text).
- Entity description blocks (character / place / event / story /
  codex / plotline).
- The Tiptap rich-text host.
- Catalog cards and hover popovers that surface `description` /
  `summary` fields.

## Third-party libraries

- Tiptap toolbar / bubble menu / suggestion menu strings routed
  through transloco at the integration layer (`editor.tiptap.*`).
- Rete node and socket labels translated at the render component
  (`editor.rete.*`).
- Firebase Auth error-code translator keyed under `auth.messages.*`.
