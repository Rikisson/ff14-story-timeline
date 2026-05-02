import { Routes } from '@angular/router';

export const CODEX_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/codex.page').then((m) => m.CodexPage),
  },
];
