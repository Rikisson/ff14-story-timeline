import { Routes } from '@angular/router';

const loadPage = () =>
  import('./feature/plotlines.page').then((m) => m.PlotlinesPage);

export const PLOTLINES_ROUTES: Routes = [
  { path: '', loadComponent: loadPage },
  { path: ':id', loadComponent: loadPage },
];
