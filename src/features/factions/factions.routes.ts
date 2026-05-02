import { Routes } from '@angular/router';

export const FACTIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/factions.page').then((m) => m.FactionsPage),
  },
];
