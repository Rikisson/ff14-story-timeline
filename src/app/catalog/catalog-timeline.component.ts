import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CalendarService } from '@features/calendar';
import { EventCardComponent, TimelineEvent } from '@features/events';
import { Story } from '@features/stories';
import { isInGameDateEmpty, InGameDate } from '@shared/models';
import { compareInGameDate, formatInGameDate } from '@shared/utils';
import { CatalogCardComponent } from './catalog-card.component';
import { SortDirection } from './catalog-filters.component';

interface TimelineItem {
  kind: 'story' | 'event';
  date: InGameDate;
  story?: Story;
  event?: TimelineEvent;
}

interface TimelineGroup {
  key: string;
  label: string;
  empty: boolean;
  stories: Story[];
  events: TimelineEvent[];
}

const UNDATED_KEY = '__undated__';
const UNDATED_LABEL = 'Undated';

@Component({
  selector: 'app-catalog-timeline',
  imports: [CatalogCardComponent, EventCardComponent],
  template: `
    <ol class="relative flex flex-col gap-8 border-l-2 border-slate-200 pl-6">
      @for (group of groups(); track group.key) {
        <li class="relative">
          <span
            class="absolute -left-[31px] top-1.5 inline-block size-3 rounded-full border-2 border-white bg-indigo-500 ring-2 ring-indigo-500"
            aria-hidden="true"
          ></span>
          <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {{ group.label }}
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
                <app-catalog-card [story]="story" [canEdit]="canManage()" />
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
  readonly canManage = input<boolean>(false);

  private readonly calendar = inject(CalendarService);

  protected readonly groups = computed<TimelineGroup[]>(() => {
    const buckets = new Map<string, TimelineGroup>();
    const eraLookup = (id: string) => this.calendar.eraOrdinalLookup(id);

    const ensure = (date: InGameDate): TimelineGroup => {
      const empty = isInGameDateEmpty(date);
      const key = empty ? UNDATED_KEY : groupKey(date);
      let group = buckets.get(key);
      if (!group) {
        group = {
          key,
          label: empty
            ? UNDATED_LABEL
            : formatInGameDate(date, {
                eraName: date.era ? this.calendar.eraNameLookup(date.era) : undefined,
                monthName: date.month ? this.calendar.monthNameLookup(date.month) : undefined,
              }) || UNDATED_LABEL,
          empty,
          stories: [],
          events: [],
        };
        buckets.set(key, group);
      }
      return group;
    };

    for (const story of this.stories()) ensure(story.inGameDate).stories.push(story);
    for (const event of this.events()) ensure(event.inGameDate).events.push(event);

    const direction = this.sortDirection();
    return Array.from(buckets.values()).sort((a, b) => {
      if (a.empty && !b.empty) return 1;
      if (b.empty && !a.empty) return -1;
      const sample = (g: TimelineGroup): InGameDate =>
        g.stories[0]?.inGameDate ?? g.events[0]?.inGameDate ?? {};
      const cmp = compareInGameDate(sample(a), sample(b), eraLookup);
      return direction === 'asc' ? cmp : -cmp;
    });
  });
}

function groupKey(d: InGameDate): string {
  if (d.display) return `display:${d.display}`;
  return [
    d.era ?? '',
    d.year ?? '',
    d.month ?? '',
    d.day ?? '',
    d.hour ?? '',
    d.minute ?? '',
    d.second ?? '',
  ].join('|');
}
