import { Routes } from '@angular/router';
import { editorGuard, universeGuard, UNIVERSE_ROUTES } from '@features/universes';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./landing.page').then((m) => m.LandingPage),
  },
  {
    path: 'library',
    loadChildren: () => import('@features/stories').then((m) => m.STORIES_ROUTES),
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
    path: 'universe',
    canActivate: [editorGuard],
    children: UNIVERSE_ROUTES,
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
