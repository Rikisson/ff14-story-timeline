import { Routes } from '@angular/router';
import { editorGuard, universeGuard } from '@features/universes';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./catalog/catalog.page').then((m) => m.CatalogPage),
  },
  {
    path: 'play',
    canActivate: [universeGuard],
    loadChildren: () => import('@features/player').then((m) => m.PLAYER_ROUTES),
  },
  {
    path: 'timeline',
    canActivate: [universeGuard],
    loadChildren: () => import('@features/timeline').then((m) => m.TIMELINE_ROUTES),
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
    path: 'plotlines',
    canActivate: [universeGuard],
    loadChildren: () => import('@features/plotlines').then((m) => m.PLOTLINES_ROUTES),
  },
  {
    path: 'items',
    canActivate: [universeGuard],
    loadChildren: () => import('@features/items').then((m) => m.ITEMS_ROUTES),
  },
  {
    path: 'factions',
    canActivate: [universeGuard],
    loadChildren: () => import('@features/factions').then((m) => m.FACTIONS_ROUTES),
  },
  {
    path: 'codex',
    canActivate: [universeGuard],
    loadChildren: () => import('@features/codex').then((m) => m.CODEX_ROUTES),
  },
  {
    path: 'calendar',
    canActivate: [universeGuard],
    loadChildren: () => import('@features/calendar').then((m) => m.CALENDAR_ROUTES),
  },
  {
    path: 'edit',
    canActivate: [editorGuard],
    loadChildren: () => import('@features/editor').then((m) => m.EDITOR_ROUTES),
  },
  {
    path: '**',
    loadComponent: () => import('./not-found.page').then((m) => m.NotFoundPage),
  },
];
