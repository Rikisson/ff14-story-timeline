import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';

const loadPage = () =>
  import('./feature/codex.page').then((m) => m.CodexPage);

// Single route config for both `/codex` and `/codex/:id` so Angular's
// default RouteReuseStrategy keeps the page mounted across the first
// list -> detail click (which otherwise destroys it and re-fetches page 1).
// The static `settings` redirect is listed first so it wins before the
// matcher would otherwise consume `settings` as an entity id.
const listOrDetail = (segments: UrlSegment[]): UrlMatchResult | null => {
  if (segments.length === 0) return { consumed: [] };
  if (segments.length === 1) return { consumed: segments, posParams: { id: segments[0] } };
  return null;
};

export const CODEX_ROUTES: Routes = [
  { path: 'settings', pathMatch: 'full', redirectTo: '/universe/settings/categories' },
  { matcher: listOrDetail, loadComponent: loadPage },
];
