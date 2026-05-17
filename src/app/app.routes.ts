import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';
import { editorGuard, universeGuard, UNIVERSE_ROUTES } from '@features/universes';

// Single route config for both `/library` and `/library/:id` so Angular's
// default RouteReuseStrategy keeps the page mounted across the first
// list -> detail click (which otherwise destroys it and re-fetches page 1).
const libraryMatcher = (segments: UrlSegment[]): UrlMatchResult | null => {
  if (segments.length === 0) return { consumed: [] };
  if (segments.length === 1) return { consumed: segments, posParams: { id: segments[0] } };
  return null;
};

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./landing.page').then((m) => m.LandingPage),
  },
  {
    path: 'library',
    children: [
      {
        matcher: libraryMatcher,
        loadComponent: () => import('./catalog/catalog.page').then((m) => m.CatalogPage),
      },
    ],
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
