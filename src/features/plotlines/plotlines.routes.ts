import { Routes } from '@angular/router';

export const PLOTLINES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/plotlines.page').then((m) => m.PlotlinesPage),
  },
];
