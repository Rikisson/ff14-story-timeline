import { Routes } from '@angular/router';

export const PLACES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/places.page').then((m) => m.PlacesPage),
  },
];
