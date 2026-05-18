import { Routes } from '@angular/router';

export const READER_ROUTES: Routes = [
  {
    path: 'story/:id',
    loadComponent: () => import('./feature/reader-story.page').then((m) => m.ReaderStoryPage),
  },
  {
    path: 'event/:id',
    loadComponent: () => import('./feature/reader-event.page').then((m) => m.ReaderEventPage),
  },
];
