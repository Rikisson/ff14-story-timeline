import { Routes } from '@angular/router';

const loadSettings = () =>
  import('./feature/universe-settings.page').then((m) => m.UniverseSettingsPage);

export const UNIVERSE_ROUTES: Routes = [
  { path: 'settings', pathMatch: 'full', redirectTo: 'settings/general' },
  { path: 'settings/:section', loadComponent: loadSettings },
];
