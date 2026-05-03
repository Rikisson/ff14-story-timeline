import { Routes } from '@angular/router';

const loadPage = () =>
  import('./feature/events.page').then((m) => m.EventsPage);

export const EVENTS_ROUTES: Routes = [
  { path: '', loadComponent: loadPage },
  { path: ':id', loadComponent: loadPage },
];
