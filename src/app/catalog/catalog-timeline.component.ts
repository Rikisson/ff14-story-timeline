import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Story } from '@features/stories';

interface TimelineGroup {
  date: string;
  stories: Story[];
}

const UNDATED_LABEL = 'Undated';

@Component({
  selector: 'app-catalog-timeline',
  imports: [RouterLink],
  template: `
    <ol class="relative flex flex-col gap-6 border-l-2 border-slate-200 pl-6">
      @for (group of groups(); track group.date) {
        <li class="relative">
          <span
            class="absolute -left-[31px] top-1.5 inline-block size-3 rounded-full border-2 border-white bg-indigo-500 ring-2 ring-indigo-500"
            aria-hidden="true"
          ></span>
          <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {{ group.date }}
          </h3>
          <ul class="flex flex-col gap-2">
            @for (story of group.stories; track story.id) {
              <li class="rounded-md border border-slate-200 bg-white px-3 py-2">
                <a
                  [routerLink]="['/play', story.id]"
                  class="text-sm font-semibold text-indigo-700 hover:underline"
                >
                  {{ story.title }}
                </a>
                @if (story.summary) {
                  <p class="mt-0.5 text-xs text-slate-600">{{ story.summary }}</p>
                }
              </li>
            }
          </ul>
        </li>
      }
    </ol>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogTimelineComponent {
  readonly stories = input.required<Story[]>();

  protected readonly groups = computed<TimelineGroup[]>(() => {
    const buckets = new Map<string, Story[]>();
    for (const story of this.stories()) {
      const key = story.inGameDate || UNDATED_LABEL;
      const list = buckets.get(key);
      if (list) list.push(story);
      else buckets.set(key, [story]);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => compareDates(a, b))
      .map(([date, stories]) => ({ date, stories }));
  });
}

function compareDates(a: string, b: string): number {
  if (a === UNDATED_LABEL) return 1;
  if (b === UNDATED_LABEL) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
