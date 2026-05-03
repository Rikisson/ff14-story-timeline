import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CalendarService } from '@features/calendar';
import { TimelineEvent } from '@features/events';
import { Plotline } from '@features/plotlines';
import { Story } from '@features/stories';
import { SortDirection } from './catalog-filters.component';
import { buildTimelineLanes } from './catalog-timeline-lanes';
import { TimelineLaneComponent } from './timeline-lane.component';

const PAGE_STEP = 12;

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

  private readonly calendar = inject(CalendarService);

  protected readonly showUnassigned = signal(true);
  private readonly pageSizes = signal<Record<string, number>>({});
  private resetSignature = '';

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
    effect(() => {
      const sig = [
        this.selectedPlotlineIds().join('|'),
        this.sortDirection(),
        this.showUnassigned() ? '1' : '0',
        this.stories().length,
        this.events().length,
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
  }

  protected toggleUnassigned(event: Event): void {
    this.showUnassigned.set((event.target as HTMLInputElement).checked);
  }
}
