import { Routes } from '@angular/router';
import { readerLeaveGuard } from './feature/reader-leave.guard';

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
        // `canDeactivate` runs each page's exit fade (visuals + audio)
        // before teardown, so every way out — a continuation jump or
        // leaving the reader entirely — fades instead of cutting.
        path: 'story/:id',
        loadComponent: () =>
          import('./feature/reader-story.page').then((m) => m.ReaderStoryPage),
        canDeactivate: [readerLeaveGuard],
      },
      {
        path: 'event/:id',
        loadComponent: () =>
          import('./feature/reader-event.page').then((m) => m.ReaderEventPage),
        canDeactivate: [readerLeaveGuard],
      },
    ],
  },
];
