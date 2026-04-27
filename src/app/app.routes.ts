import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./catalog/catalog.page').then((m) => m.CatalogPage),
  },
  {
    path: 'characters',
    loadChildren: () => import('@features/characters').then((m) => m.CHARACTERS_ROUTES),
  },
  {
    path: 'places',
    loadChildren: () => import('@features/places').then((m) => m.PLACES_ROUTES),
  },
  {
    path: 'events',
    loadChildren: () => import('@features/events').then((m) => m.EVENTS_ROUTES),
  },
  {
    path: 'play',
    loadChildren: () => import('@features/player').then((m) => m.PLAYER_ROUTES),
  },
  {
    path: 'edit',
    loadChildren: () => import('@features/editor').then((m) => m.EDITOR_ROUTES),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
