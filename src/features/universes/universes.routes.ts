import { Routes } from '@angular/router';

export const UNIVERSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/universes.page').then((m) => m.UniversesPage),
  },
];
