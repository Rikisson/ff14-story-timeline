You are an expert in TypeScript, Angular, NgRx, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## Docs Reference

Before executing any request, check the `docs` folder for applicable rules. Every doc is split into **Rules** (standing constraints) and **Implementation** (open backlog; items removed when shipped, never demoted to a history log):
- `docs/narrative-engine-impl.md` — entity tiers, references, scope locks, inline-ref tokens, scene model, scene rendering. Consult before touching entity types, picker UX, scene composition, or `${kind:<guid>}` references.
- `docs/backend-rules.md` — Firestore/R2/Auth posture, realtime listener policy, pagination, search, cost canaries. Consult before touching the data layer, asset storage, or anything that affects the bill.
- `docs/media-rules.md` — asset schema, upload flow, loading. Consult before touching uploads, asset pickers, or asset loading.
- `docs/styling-rules.md` — design tokens, theme switching, button hierarchy, editor/Rete styling exceptions. Consult before adding color utilities, building new components, or theming changes.
- `docs/i18n-rules.md` — transloco usage, locale state, key shape, content-locale tagging. Consult before adding UI strings, touching locale switching, or wiring per-feature translations.

If a request conflicts with documented rules or architecture:
- Point out the conflict
- Explain it briefly
- Ask whether to proceed or adjust the request

When updating these docs, rewrite affected sections naturally as if writing them for the first time. Don't append "(updated)" markers, dated change notes, or bolt-on patch bullets that read as additions — the reader should not be able to tell which sentence shipped first. This applies unless the user explicitly asks for an additive change.

## General Guidelines

- Prefer minimal, scoped changes that solve the task directly
- Do not refactor unrelated code
- Follow existing project patterns and architecture
- Do not introduce new abstractions unless clearly justified
- Prefer simple, readable, maintainable code over clever solutions
- Apply KISS and SOLID pragmatically; avoid overengineering
- Use clear, consistent naming
- Avoid circular dependencies and respect module boundaries
- Briefly explain assumptions, tradeoffs, and notable risks when making changes

## Comments

- Do not add comments or JSDoc/method-doc blocks. They fall out of date, restate what the code already says, and accumulate into noise that obscures the code.
- Let the code explain itself instead: clear names, small single-purpose functions, and expressive types.
- Strive to remove comments and doc blocks from any code you create or modify — leave each file cleaner than you found it.
- The only exception is a short note capturing genuinely non-obvious rationale the code cannot convey itself: why an unintuitive workaround exists, or a constraint that isn't visible locally. Keep these rare, and keep them about *why*, never *what*.
- Functional directives such as `// eslint-disable-*` and `@ts-expect-error` are linter and compiler instructions, not documentation — keep them, together with any justification they require.

## Commits & Documentation

- Never commit on your own. Apply the changes, summarize what was done, and wait for the user to review and explicitly confirm before running `git commit`. The only exception is when the user has granted permission to commit immediately for that specific task.
- Do not create new documentation files — `docs/` entries, `README`s, design notes, or anything similar — unless the user explicitly asks for one. If you believe a new doc carries real value, propose it and wait for approval before creating it. Modifying existing documentation also requires the user's agreement.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

## NgRx

- Prefer `@ngrx/signals` (`signalStore`) for local and feature state — it aligns with Angular's signal model
- Use `@ngrx/store` only for truly global, cross-feature state that must be shared app-wide
- Define state with `withState()`, computed with `withComputed()`, methods with `withMethods()`
- Use `withEntities()` from `@ngrx/signals/entities` for collections
- Use `tapResponse` from `@ngrx/operators` inside `rxMethod` to handle errors safely
- Keep effects inside `withMethods()` using `rxMethod` for observable-based async operations
- Use `@ngrx/store-devtools` in development only — never in production builds
- Use `@ngrx/router-store` to sync router state into the store when route state is needed globally
- Keep selectors pure and co-located with their feature state
- Never mutate state directly — always return new state objects
- Use `EntityAdapter` from `@ngrx/entity` for normalized CRUD collections in the global store
