# FF14 Story Timeline

An interactive visual-novel and timeline tool for cataloging characters,
places, events, and branching stories — currently focused on FFXIV-inspired
narratives.

## Tech stack

- Angular 21 (standalone components, signals)
- NgRx — `@ngrx/signals` for feature stores; `@ngrx/store` for the auth slice
- Firebase — Auth (Google sign-in), Firestore, Storage
- Tailwind CSS v4
- Rete.js for the editor's node-based scene canvas
- Vitest for unit tests
- GitHub Pages deploy via `.github/workflows/deploy.yml`

## Local development

```bash
pnpm install
pnpm start           # ng serve on http://localhost:4200
pnpm build           # production build into dist/
pnpm test            # vitest
```

The Firebase project is wired up in `src/app/firebase.config.ts`. Firestore
rules (`firestore.rules`) and Storage rules (`storage.rules`) live at the repo
root and are deployed manually via the Firebase CLI.

## Project layout

- `src/app/` — root component, routing, Firebase wiring, catalog page (entry route)
- `src/features/` — feature folders (`auth`, `stories`, `characters`, `places`, `events`, `editor`, `player`), each with `data-access/`, `feature/`, `ui/`, and an `index.ts` barrel
- `src/shared/ui/` — design-system buttons (`uiPrimary` / `uiSecondary` / `uiGhost` / `uiDanger`)
- `src/shared/utils/` — small utilities (e.g. `cn` for class merging)
- `src/mocks/` — seeder service + seed data, gated to a hard-coded author UID

## Conventions and backlog

- Project-specific coding rules live in `.claude/CLAUDE.md`.
- The current technical-debt, feature-debt, and new-feature backlog lives in `docs/dev-improvements.md` — consult before starting non-trivial work.
