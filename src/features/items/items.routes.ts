import { Routes } from '@angular/router';

const loadPage = () =>
  import('./feature/items.page').then((m) => m.ItemsPage);

export const ITEMS_ROUTES: Routes = [
  { path: '', loadComponent: loadPage },
  { path: ':id', loadComponent: loadPage },
];
