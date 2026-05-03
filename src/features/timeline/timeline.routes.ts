import { Routes } from '@angular/router';

export const TIMELINE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/timeline.page').then((m) => m.TimelinePage),
  },
];
