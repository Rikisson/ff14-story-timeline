import { Routes } from '@angular/router';

export const READER_ROUTES: Routes = [
  {
    path: ':id',
    loadComponent: () => import('./feature/reader-story.page').then((m) => m.ReaderStoryPage),
  },
];
