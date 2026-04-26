import { Routes } from '@angular/router';
import { authGuard } from '@features/auth';

export const EDITOR_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./feature/editor-list.page').then((m) => m.EditorListPage),
  },
  {
    path: ':id',
    canActivate: [authGuard],
    loadComponent: () => import('./feature/editor.page').then((m) => m.EditorPage),
  },
];
