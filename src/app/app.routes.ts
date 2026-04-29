import { Routes } from '@angular/router';
import { universeGuard } from '@features/universes';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./catalog/catalog.page').then((m) => m.CatalogPage),
  },
  {
    path: 'universes',
    loadChildren: () => import('@features/universes').then((m) => m.UNIVERSES_ROUTES),
  },
  {
    path: 'characters',
    canActivate: [universeGuard],
    loadChildren: () => import('@features/characters').then((m) => m.CHARACTERS_ROUTES),
  },
  {
    path: 'places',
    canActivate: [universeGuard],
    loadChildren: () => import('@features/places').then((m) => m.PLACES_ROUTES),
  },
  {
    path: 'events',
    canActivate: [universeGuard],
    loadChildren: () => import('@features/events').then((m) => m.EVENTS_ROUTES),
  },
  {
    path: 'play',
    canActivate: [universeGuard],
    loadChildren: () => import('@features/player').then((m) => m.PLAYER_ROUTES),
  },
  {
    path: 'edit',
    canActivate: [universeGuard],
    loadChildren: () => import('@features/editor').then((m) => m.EDITOR_ROUTES),
  },
  {
    path: '**',
    loadComponent: () => import('./not-found.page').then((m) => m.NotFoundPage),
  },
];
