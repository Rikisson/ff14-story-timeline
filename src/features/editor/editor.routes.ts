import { Routes } from '@angular/router';
import { authGuard } from '@features/auth';

export const EDITOR_ROUTES: Routes = [
  {
    path: ':id',
    canActivate: [authGuard],
    loadComponent: () => import('./feature/editor.page').then((m) => m.EditorPage),
  },
];
