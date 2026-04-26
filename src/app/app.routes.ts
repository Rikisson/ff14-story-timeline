import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./catalog/catalog.page').then((m) => m.CatalogPage),
  },
  {
    path: 'play/:id',
    loadComponent: () => import('./player/player.page').then((m) => m.PlayerPage),
  },
  {
    path: 'edit',
    canActivate: [authGuard],
    loadComponent: () => import('./editor/editor-list.page').then((m) => m.EditorListPage),
  },
  {
    path: 'edit/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./editor/editor.page').then((m) => m.EditorPage),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
