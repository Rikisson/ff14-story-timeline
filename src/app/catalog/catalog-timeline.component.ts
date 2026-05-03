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
import { buildTimelineLanes } from './catalog-timeline-lanes';
import { TimelineLaneComponent } from './timeline-lane.component';

const PAGE_STEP = 25;

@Component({
  selector: 'app-catalog-timeline',
  imports: [TimelineLaneComponent],
  template: `
    <div class="flex flex-col gap-6">
      @if (selectedPlotlineIds().length > 0) {
        <label class="flex items-center gap-2 self-start text-sm text-slate-700">
          <input
            type="checkbox"
            [checked]="showUnassigned()"
            (change)="toggleUnassigned($event)"
          />
          Show unassigned items
        </label>
      }

      @for (lane of lanes(); track lane.key) {
        <app-timeline-lane
          [lane]="lane"
          [sortDirection]="sortDirection()"
          [canManage]="canManage()"
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
  readonly canManage = input<boolean>(false);
  readonly storiesHasMore = input<boolean>(false);
  readonly eventsHasMore = input<boolean>(false);

  readonly loadMoreStories = output<void>();
  readonly loadMoreEvents = output<void>();

  private readonly calendar = inject(CalendarService);

  protected readonly showUnassigned = signal(true);
  private readonly pageSizes = signal<Record<string, number>>({});
  private resetSignature = '';

  protected readonly serverHasMore = computed(
    () => this.storiesHasMore() || this.eventsHasMore(),
  );

  protected readonly lanes = computed(() =>
    buildTimelineLanes({
      stories: this.stories(),
      events: this.events(),
      plotlines: this.plotlines(),
      selectedPlotlineIds: this.selectedPlotlineIds(),
      showUnassignedLane: this.showUnassigned(),
      sortDirection: this.sortDirection(),
      eraOrdinalLookup: (id) => this.calendar.eraOrdinalLookup(id),
    }),
  );

  constructor() {
    // Reset per-lane page sizes when the user changes filters, sort, or the
    // unassigned-lane toggle — but NOT when the source arrays grow due to a
    // server-side loadMore (which we want to preserve accumulated pageSize for).
    effect(() => {
      const sig = [
        this.selectedPlotlineIds().join('|'),
        this.sortDirection(),
        this.showUnassigned() ? '1' : '0',
      ].join('::');
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

  protected toggleUnassigned(event: Event): void {
    this.showUnassigned.set((event.target as HTMLInputElement).checked);
  }
}
