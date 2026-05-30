import { Routes } from '@angular/router';

export const EXPLORE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/explore.page').then((m) => m.ExplorePage),
  },
];
