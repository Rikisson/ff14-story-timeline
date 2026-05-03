import { Routes } from '@angular/router';

const loadPage = () =>
  import('./feature/characters.page').then((m) => m.CharactersPage);

export const CHARACTERS_ROUTES: Routes = [
  { path: '', loadComponent: loadPage },
  { path: ':id', loadComponent: loadPage },
];
