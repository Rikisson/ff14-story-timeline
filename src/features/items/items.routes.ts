import { Routes } from '@angular/router';

export const ITEMS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/items.page').then((m) => m.ItemsPage),
  },
];
