import { Routes } from '@angular/router';

export const PLAYER_ROUTES: Routes = [
  {
    path: ':id',
    loadComponent: () => import('./feature/player.page').then((m) => m.PlayerPage),
  },
];
