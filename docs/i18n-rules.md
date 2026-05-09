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

## Template usage

- Default: the `*transloco` structural directive at the component
  template root, with `prefix:` set to the component's scope. One
  subscription per component, scope-prefix folded in:
  `<ng-container *transloco="let t; prefix: 'auth'">{{ t('action.signIn') }}</ng-container>`.
- Reserve the `transloco` pipe for one-off bindings outside a directive
  region (rare).
- For dynamic interpolation, pass params as the second argument:
  `t('tooltip.accountMenu', { name: accountLabel() })`.
- Don't use the directive's `read:` parameter — it's deprecated in
  transloco 8 and removed in 9.

## Locales

- Supported: `en` (default), `uk`.
- Initial UI locale: `localStorage.uiLocale` → first matching
  `navigator.languages` entry → `en`.
- The user's choice writes back to `localStorage.uiLocale` through the
  same service that calls `TranslocoService.setActiveLang`.
- `LOCALE_ID` mirrors the active transloco language so Angular's
  `DatePipe` / `DecimalPipe` follow.

## File layout

- Global chrome (used in 3+ feature scopes): `public/i18n/{en,uk}.json`.
  Bundled into the JS via TypeScript imports in
  `src/app/transloco-loader.ts` so prerender and first paint don't need
  a network round-trip; the same files are also copied to `dist/` as
  static assets, available for HTTP fetching if a future loader needs
  them.
- Per-feature scope files: `src/features/{x}/i18n/{en,uk}.json`,
  registered with `provideTranslocoScope({ scope: 'x', loader })` on
  the feature's lazy route. The scope name matches the feature folder,
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
  `action`, `field`, `empty`, `message`, `tooltip`, `validation`,
  `enum`. Singular — every group reads as "this string is in the
  *action* / *field* / etc. category." Don't force three pre-set
  groups; a small scope can sit flat (`general.loading`,
  `auth.signOut`).
- **Key**: camelCase, descriptive, self-documenting. Free-form — the
  singular rule applies only to scope and group, so keys can be
  `seedTestData`, `noPlotlines`, or `landingNoUniversesGuest`.

## What goes where

| String kind                                                     | Group        |
|-----------------------------------------------------------------|--------------|
| Buttons, menu items, command names, link text                   | `action`     |
| Form field labels, table headers, filter chips, dropdown labels | `field`      |
| Empty-state copy, search placeholders, hint text                | `empty`      |
| Toasts, dialog bodies, success/error feedback, loading states   | `message`    |
| Hover tooltips, ARIA hints, keyboard chips                      | `tooltip`    |
| Reactive Forms validator messages                               | `validation` |
| App-defined enum value labels (plotline status, scene position) | `enum`       |

Author-defined enum values (codex categories, era names, plotline
labels) are *data*, not i18n — they live on per-universe config docs.

## Validation strings

- **Generic validators** (`required`, `email`, `minLength`, `maxLength`,
  `pattern`) live at `general.validation.*`. The shared
  `resolveValidationError(errors)` helper in `@shared/utils` maps an
  Angular `ValidationErrors` object to a `general.validation.*` key
  plus interpolation params (`{{ min }}`, `{{ max }}`). Drop in
  `<app-form-error [control]="form.controls.name" />` from `@shared/ui`
  to render the first error inline once the control is dirty/touched;
  `[showWhenUntouched]="true"` forces always-on display. (The
  `validation` group is the one canonical group whose name reads
  natural in either form — keep it singular for consistency.)
- **Field-specific validation** (e.g. *"A character with this name
  already exists in {{universe}}"*) lives in the relevant scope's
  `validation` group. For these, pass an explicit translation key to
  the form-error component or render a `<p>` directly.

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
universe's locale via the `appContentLang` directive (exported from
`@features/universes`). The directive reads `UniverseStore.activeUniverse()?.locale`
and applies `[attr.lang]` to its host; children inherit the language
through DOM inheritance.

- Scene background prose, scene speaker text, entity descriptions,
  codex bodies, story summaries — apply `appContentLang` to the
  enclosing prose element.
- Tiptap-rendered output sets `lang` on its host (`<app-rich-text-input
  appContentLang>`), not on every paragraph.
- Chrome surrounding the content (panel header, edit button, metadata
  chips) sits *outside* the tagged element and inherits the document
  `lang` from the active UI locale via `<html lang>`.
- Default screen-reader voice follows `<html lang>`, so chrome reads in
  the UI locale; content blocks pivot through their own `lang`
  attribute.

## Locale switching

- The UI toggle (`<app-locale-toggle>`) lives in the app header next
  to the theme toggle; cycles `EN ↔ UK`.
- Switching is synchronous from the user's perspective — no reload.
  Transloco swaps the active language for chrome strings and
  `<html lang>` flips immediately.
- `LOCALE_ID` is bound at bootstrap to the persisted choice. Angular's
  `DatePipe` / `DecimalPipe` formatting follows the user's saved
  preference from page load; runtime switches don't retune these pipes
  until the next reload. Acceptable today because date/number-heavy
  surfaces are scarce; revisit if it bites.
- Content locale never changes via the toggle; it is whatever the
  active universe declares.

## Third-party UI strings

- **Tiptap** — toolbar aria-labels, the entity-ref hint, and the
  suggestion popup's empty-state copy live under `general.tooltip.tiptap*`
  / `general.message.tiptapRefHint` / `general.empty.tiptapNoMatches`.
  The widget is in `@shared/ui/rich-text-input`, so the strings sit in
  `general` rather than the `editor` scope. The suggestion renderer
  takes a `getNoMatchesLabel: () => string` callback so it picks up
  the active locale on each popup render.
- **Rete** — our scene-graph integration is data-driven (node labels
  come from `scene.label` / `shortId`, sockets are unlabeled), so
  there are no rete-owned chrome strings to translate today. Adopt a
  scoped `editor.rete.*` group when we add labelled sockets or
  inspector chrome.
- **Firebase Auth** — error codes pass through `translateFirebaseAuthError`
  in `@features/auth`, which maps known codes to `auth.message.*`
  keys (with `errorGeneric` as a `{{ code }}` fallback). The SDK's
  English `.message` is never displayed.

## Static prerender

The build runs `outputMode: static` — pages prerender at build time
with `defaultLang: 'en'` baked in. There is no request-time
`Accept-Language` because the HTML is served as a static asset.

A pre-hydration script in `src/index.html` reads `localStorage.uiLocale`
(falling back to `navigator.languages`, then `en`) before Angular
boots and sets `<html lang>` to the resolved value, so the document
language is correct before the first paint. Translations live in the
JS bundle, so chrome appears in the right locale on the first frame
without a network round-trip.

## Example

A trimmed `public/i18n/en.json`:

```json
{
  "general": {
    "action": { "save": "Save", "cancel": "Cancel", "delete": "Delete" },
    "field": { "name": "Name", "status": "Status" },
    "message": { "loading": "Loading…", "saveSuccess": "Saved" },
    "validation": {
      "required": "This field is required",
      "email": "Enter a valid email",
      "minLength": "Must be at least {{ min }} characters"
    }
  },
  "auth": {
    "action": { "signIn": "Sign in", "signOut": "Sign out" },
    "field": { "email": "Email", "password": "Password" },
    "message": { "signInError": "Sign-in failed: {{ reason }}" }
  }
}
```

A scoped feature file at `src/features/character/i18n/en.json` (no
scope prefix inside the file — the prefix comes from registration):

```json
{
  "action": { "create": "New character", "edit": "Edit character" },
  "field": { "name": "Name", "appearance": "Appearance" },
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
   nesting. Scope and group are singular; the key is free-form.
4. Cross-cutting validator messages live at `general.validation.*`;
   field-specific validation goes in the scope's `validation` group.
5. ICU MessageFormat for plurals and selects. Never concatenate
   translated fragments.
6. Use `*transloco="let t; prefix: '<scope>'"` at the template root
   over the `| transloco` pipe; the directive subscribes once and folds
   the scope prefix in. (`read:` is deprecated; don't use it.)
7. New content-prose surfaces apply the `appContentLang` directive
   (from `@features/universes`).
8. Add keys to **both** `en.json` and `uk.json` in the same change.
   The Ukrainian value can be a TODO marker (`"⟦TODO⟧ Save"`) when no
   translation is ready, but the key must exist in both files so
   missing-key warnings stay clean.

---

# Implementation

Open changes. Remove items as they ship.

*(Empty — every shipped i18n pass is currently reflected in the rules
above.)*
