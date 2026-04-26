import { Routes } from '@angular/router';

export const CHARACTERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/characters.page').then((m) => m.CharactersPage),
  },
];
