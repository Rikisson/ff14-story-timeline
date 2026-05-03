import { Routes } from '@angular/router';

const loadPage = () =>
  import('./feature/factions.page').then((m) => m.FactionsPage);

export const FACTIONS_ROUTES: Routes = [
  { path: '', loadComponent: loadPage },
  { path: ':id', loadComponent: loadPage },
];
