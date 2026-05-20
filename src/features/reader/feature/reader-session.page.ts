import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LayoutStore } from '@shared/data-access';

/**
 * Routed parent for the reader. It renders nothing of its own — just a
 * `<router-outlet>` for the story and event pages — but it stays mounted
 * for as long as the URL is under `/reader`. That makes its teardown the
 * one honest place to drop native fullscreen: navigating between the story
 * and event pages (forward via a continuation, or via browser-back) keeps
 * this component alive, so fullscreen survives reader-internal navigation.
 * Only leaving `/reader` entirely destroys it and exits fullscreen.
 *
 * Named "session" rather than "shell" because `docs/narrative-engine-impl.md`
 * already uses "reader shell" for the page-level audio host above
 * `scene-view` — a different concept.
 */
@Component({
  selector: 'app-reader-session-page',
  host: { class: 'block h-full' },
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderSessionPage {
  private readonly layout = inject(LayoutStore);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      void this.layout.exitFullscreen();
    });
  }
}
