import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Single-frame reader surface for `TimelineEvent`. The full implementation
 * (event lookup, background + bgm + nextRefs, single-tap-to-continue)
 * lands in the dedicated reader-event milestone task. For now this is a
 * placeholder so the `/reader/event/:id` route resolves and links from
 * the timeline/catalog don't 404.
 */
@Component({
  selector: 'app-reader-event-page',
  host: { class: 'block h-full' },
  imports: [RouterLink],
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <p class="m-0 text-foreground-subtle">
        Event reader coming soon for: <code>{{ id() }}</code>
      </p>
      <p>
        <a routerLink="/library" class="text-accent hover:underline">Back to catalog</a>
      </p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderEventPage {
  readonly id = input.required<string>();
}
