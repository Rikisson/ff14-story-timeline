import { Routes } from '@angular/router';

const loadPage = () =>
  import('./feature/codex.page').then((m) => m.CodexPage);

export const CODEX_ROUTES: Routes = [
  { path: '', loadComponent: loadPage },
  { path: ':id', loadComponent: loadPage },
];
