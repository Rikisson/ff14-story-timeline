import { Routes } from '@angular/router';

export const EVENTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/events.page').then((m) => m.EventsPage),
  },
];
