import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Story } from '@features/stories';
import { CatalogCardComponent } from './catalog-card.component';

interface TimelineGroup {
  date: string;
  stories: Story[];
}

const UNDATED_LABEL = 'Undated';

@Component({
  selector: 'app-catalog-timeline',
  imports: [CatalogCardComponent],
  template: `
    <ol class="relative flex flex-col gap-8 border-l-2 border-slate-200 pl-6">
      @for (group of groups(); track group.date) {
        <li class="relative">
          <span
            class="absolute -left-[31px] top-1.5 inline-block size-3 rounded-full border-2 border-white bg-indigo-500 ring-2 ring-indigo-500"
            aria-hidden="true"
          ></span>
          <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {{ group.date }}
          </h3>
          <ul
            class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] justify-start gap-4"
          >
            @for (story of group.stories; track story.id) {
              <li>
                <app-catalog-card [story]="story" [canEdit]="canEdit(story)" />
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
  readonly currentUserUid = input<string | null>(null);

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

  protected canEdit(story: Story): boolean {
    const uid = this.currentUserUid();
    return !!uid && uid === story.authorUid;
  }
}

function compareDates(a: string, b: string): number {
  if (a === UNDATED_LABEL) return 1;
  if (b === UNDATED_LABEL) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
