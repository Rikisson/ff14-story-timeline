import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';

// Single route config for both `/library` and `/library/:id` so Angular's
// default RouteReuseStrategy keeps the page mounted across the first
// list -> detail click (which otherwise destroys it and re-fetches page 1).
const libraryMatcher = (segments: UrlSegment[]): UrlMatchResult | null => {
  if (segments.length === 0) return { consumed: [] };
  if (segments.length === 1) return { consumed: segments, posParams: { id: segments[0] } };
  return null;
};

export const STORIES_ROUTES: Routes = [
  {
    matcher: libraryMatcher,
    loadComponent: () => import('./feature/stories.page').then((m) => m.StoriesPage),
  },
];
