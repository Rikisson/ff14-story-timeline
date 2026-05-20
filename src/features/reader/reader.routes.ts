import { Routes } from '@angular/router';

export const READER_ROUTES: Routes = [
  {
    // `ReaderSessionPage` is a routed parent that stays mounted for the
    // whole `/reader/*` lifetime. It owns the fullscreen teardown so
    // navigating between the story and event children never drops it.
    path: '',
    loadComponent: () =>
      import('./feature/reader-session.page').then((m) => m.ReaderSessionPage),
    children: [
      {
        path: 'story/:id',
        loadComponent: () =>
          import('./feature/reader-story.page').then((m) => m.ReaderStoryPage),
      },
      {
        path: 'event/:id',
        loadComponent: () =>
          import('./feature/reader-event.page').then((m) => m.ReaderEventPage),
      },
    ],
  },
];
