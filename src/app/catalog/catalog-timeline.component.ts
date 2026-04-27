import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Story } from '@features/stories';
import { EventCardComponent, TimelineEvent } from '@features/events';
import { CatalogCardComponent } from './catalog-card.component';
import { SortDirection } from './catalog-filters.component';

interface TimelineGroup {
  date: string;
  stories: Story[];
  events: TimelineEvent[];
}

const UNDATED_LABEL = 'Undated';

@Component({
  selector: 'app-catalog-timeline',
  imports: [CatalogCardComponent, EventCardComponent],
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
            @for (event of group.events; track event.id) {
              <li>
                <app-event-card [event]="event" />
              </li>
            }
            @for (story of group.stories; track story.id) {
              <li>
                <app-catalog-card [story]="story" [canEdit]="canEditStory(story)" />
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
  readonly events = input<TimelineEvent[]>([]);
  readonly sortDirection = input<SortDirection>('asc');
  readonly currentUserUid = input<string | null>(null);

  protected readonly groups = computed<TimelineGroup[]>(() => {
    const buckets = new Map<string, TimelineGroup>();
    const ensure = (key: string): TimelineGroup => {
      let group = buckets.get(key);
      if (!group) {
        group = { date: key, stories: [], events: [] };
        buckets.set(key, group);
      }
      return group;
    };
    for (const story of this.stories()) {
      ensure(story.inGameDate || UNDATED_LABEL).stories.push(story);
    }
    for (const event of this.events()) {
      ensure(event.inGameDate || UNDATED_LABEL).events.push(event);
    }
    const direction = this.sortDirection();
    return Array.from(buckets.values()).sort((a, b) => compareDates(a.date, b.date, direction));
  });

  protected canEditStory(story: Story): boolean {
    const uid = this.currentUserUid();
    return !!uid && uid === story.authorUid;
  }
}

function compareDates(a: string, b: string, direction: SortDirection): number {
  if (a === UNDATED_LABEL) return 1;
  if (b === UNDATED_LABEL) return -1;
  const cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? cmp : -cmp;
}
