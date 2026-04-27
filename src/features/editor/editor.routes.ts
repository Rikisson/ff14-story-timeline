import { Routes } from '@angular/router';
import { authGuard } from '@features/auth';
import { unsavedChangesGuard } from './data-access/unsaved-changes.guard';

export const EDITOR_ROUTES: Routes = [
  {
    path: ':id',
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () => import('./feature/editor.page').then((m) => m.EditorPage),
  },
];
