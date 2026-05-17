import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';

const loadPage = () =>
  import('./feature/events.page').then((m) => m.EventsPage);

// Single route config for both `/events` and `/events/:id` so Angular's
// default RouteReuseStrategy keeps the page mounted across the first
// list -> detail click (which otherwise destroys it and re-fetches page 1).
const listOrDetail = (segments: UrlSegment[]): UrlMatchResult | null => {
  if (segments.length === 0) return { consumed: [] };
  if (segments.length === 1) return { consumed: segments, posParams: { id: segments[0] } };
  return null;
};

export const EVENTS_ROUTES: Routes = [
  { matcher: listOrDetail, loadComponent: loadPage },
];
