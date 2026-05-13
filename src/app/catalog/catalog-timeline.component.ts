import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CalendarService } from '@features/calendar';
import { TimelineEvent } from '@features/events';
import { Plotline } from '@features/plotlines';
import { Story } from '@features/stories';
import { SortDirection } from './catalog-filters.component';
import { buildTimelineLanes, UNASSIGNED_LANE_KEY } from './catalog-timeline-lanes';
import { TimelineLaneComponent } from './timeline-lane.component';

const PAGE_STEP = 25;

@Component({
  selector: 'app-catalog-timeline',
  imports: [TimelineLaneComponent],
  template: `
    <div class="flex flex-col gap-6">
      @for (lane of lanes(); track lane.key) {
        <app-timeline-lane
          [lane]="lane"
          [sortDirection]="sortDirection()"
          [pageSize]="pageSizeFor(lane.key)"
          [serverHasMore]="serverHasMore()"
          (loadMore)="loadMoreLane(lane.key)"
        />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogTimelineComponent {
  readonly stories = input.required<Story[]>();
  readonly events = input<TimelineEvent[]>([]);
  readonly plotlines = input<Plotline[]>([]);
  readonly selectedPlotlineIds = input<string[]>([]);
  readonly sortDirection = input<SortDirection>('asc');
  readonly storiesHasMore = input<boolean>(false);
  readonly eventsHasMore = input<boolean>(false);

  readonly loadMoreStories = output<void>();
  readonly loadMoreEvents = output<void>();

  private readonly calendar = inject(CalendarService);

  private readonly pageSizes = signal<Record<string, number>>({});
  private resetSignature = '';

  protected readonly serverHasMore = computed(
    () => this.storiesHasMore() || this.eventsHasMore(),
  );

  // "Unassigned" is exposed as a synthetic plotline option in the filter, so
  // we split the incoming selection: real plotline IDs drive lane partitioning,
  // and the sentinel separately controls whether the unassigned lane renders.
  private readonly realSelectedPlotlineIds = computed(() =>
    this.selectedPlotlineIds().filter((id) => id !== UNASSIGNED_LANE_KEY),
  );
  private readonly includeUnassignedLane = computed(() =>
    this.selectedPlotlineIds().includes(UNASSIGNED_LANE_KEY),
  );

  protected readonly lanes = computed(() =>
    buildTimelineLanes({
      stories: this.stories(),
      events: this.events(),
      plotlines: this.plotlines(),
      selectedPlotlineIds: this.realSelectedPlotlineIds(),
      showUnassignedLane: this.includeUnassignedLane(),
      sortDirection: this.sortDirection(),
      eraOrdinalLookup: (id) => this.calendar.eraOrdinalLookup(id),
    }),
  );

  constructor() {
    // Reset per-lane page sizes when the user changes filters or sort — but
    // NOT when the source arrays grow due to a server-side loadMore (which we
    // want to preserve accumulated pageSize for). The unassigned sentinel is
    // part of selectedPlotlineIds, so toggling it is captured by the same key.
    effect(() => {
      const sig = [this.selectedPlotlineIds().join('|'), this.sortDirection()].join('::');
      if (sig !== this.resetSignature) {
        this.resetSignature = sig;
        this.pageSizes.set({});
      }
    });
  }

  protected pageSizeFor(key: string): number {
    return this.pageSizes()[key] ?? PAGE_STEP;
  }

  protected loadMoreLane(key: string): void {
    this.pageSizes.update((m) => ({
      ...m,
      [key]: (m[key] ?? PAGE_STEP) + PAGE_STEP,
    }));
    if (this.eventsHasMore()) this.loadMoreEvents.emit();
    if (this.storiesHasMore()) this.loadMoreStories.emit();
  }
}
