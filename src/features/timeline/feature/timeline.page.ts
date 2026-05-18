import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { Plotline, PlotlinesService } from '@features/plotlines';
import { SortDirection, UNASSIGNED_LANE_KEY } from '@shared/data-access';
import { PageHeaderComponent } from '@shared/ui';
import {
  CatalogTimelineComponent,
  TimelineLaneDescriptor,
} from '../../../app/catalog/catalog-timeline.component';
import {
  EMPTY_TIMELINE_FILTERS,
  TimelineFilters,
  TimelineFiltersComponent,
} from './timeline-filters.component';
import timelineEn from '../i18n/en.json';
import timelineUk from '../i18n/uk.json';

@Component({
  selector: 'app-timeline-page',
  imports: [
    CatalogTimelineComponent,
    PageHeaderComponent,
    TimelineFiltersComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'timeline',
      loader: {
        en: () => Promise.resolve(timelineEn),
        uk: () => Promise.resolve(timelineUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'timeline'">
      <div class="flex flex-col gap-4">
        <app-page-header
          [title]="t('field.title')"
          [subtitle]="t('message.subtitle')"
        >
          <app-timeline-filters
            [value]="filters()"
            [sortDirection]="sortDirection()"
            (filtersChange)="onFiltersChange($event)"
            (sortDirectionChange)="sortDirection.set($event)"
            (reset)="filters.set(EMPTY_FILTERS)"
          />
        </app-page-header>

        <app-catalog-timeline
          [lanes]="lanes()"
          [sortDirection]="sortDirection()"
        />
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelinePage {
  private readonly plotlinesService = inject(PlotlinesService);
  private readonly transloco = inject(TranslocoService);

  protected readonly filters = signal<TimelineFilters>(EMPTY_TIMELINE_FILTERS);
  protected readonly sortDirection = signal<SortDirection>('desc');
  protected readonly EMPTY_FILTERS = EMPTY_TIMELINE_FILTERS;

  /**
   * Per-id canonical lookup for the selected plotlines. Refreshed
   * whenever the selection changes; one batched `in` read covers up to
   * 30 lanes (`PlotlinesService.getByIds`). Each entry carries label +
   * color — neither of which lives on the directory projection (color
   * is plotline-specific authored data).
   */
  private readonly selectedPlotlines = signal<Map<string, Plotline>>(new Map());

  protected readonly lanes = computed<TimelineLaneDescriptor[]>(() => {
    const f = this.filters();
    if (f.plotlines.length === 0 && !f.showUnassigned) {
      return [{ laneKey: null, label: '' }];
    }
    const lookup = this.selectedPlotlines();
    const out: TimelineLaneDescriptor[] = [];
    for (const id of f.plotlines) {
      const p = lookup.get(id);
      if (p) out.push({ laneKey: p.id, label: p.title, color: p.color });
    }
    if (f.showUnassigned) {
      out.push({
        laneKey: UNASSIGNED_LANE_KEY,
        label: this.transloco.translate('timeline.field.unassigned'),
      });
    }
    return out;
  });

  protected onFiltersChange(next: TimelineFilters): void {
    this.filters.set(next);
  }

  constructor() {
    effect(() => {
      const ids = this.filters().plotlines;
      if (ids.length === 0) {
        if (this.selectedPlotlines().size > 0) this.selectedPlotlines.set(new Map());
        return;
      }
      const missing = ids.filter((id) => !this.selectedPlotlines().has(id));
      if (missing.length === 0) return;
      void this.plotlinesService.getByIds(missing).then((fetched) => {
        if (fetched.size === 0) return;
        this.selectedPlotlines.update((curr) => {
          const next = new Map(curr);
          for (const [id, p] of fetched) next.set(id, p);
          return next;
        });
      });
    });
  }
}
