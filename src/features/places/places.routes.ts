import { Routes } from '@angular/router';

const loadPage = () =>
  import('./feature/places.page').then((m) => m.PlacesPage);

export const PLACES_ROUTES: Routes = [
  { path: '', loadComponent: loadPage },
  { path: ':id', loadComponent: loadPage },
];
