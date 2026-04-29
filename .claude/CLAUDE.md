You are an expert in TypeScript, Angular, NgRx, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## Docs Reference

Before executing any request, check the `docs` folder for applicable rules:
- `docs/dev-improvements.md` — known technical debt, feature debt, and new-feature backlog. Consult before starting non-trivial work to avoid duplicating planned changes or contradicting noted constraints.
- `docs/narrative-engine-impl.md` — implementation notes for the narrative engine (EntityRef, Universe scope, storage layout, picker behavior, migration steps). Consult before touching entity types, picker UX, or inline `${kind:<guid>}` references.

If a request conflicts with documented rules or architecture:
- Point out the conflict
- Explain it briefly
- Ask whether to proceed or adjust the request

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
