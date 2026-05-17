import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { PlotlinesService } from '@features/plotlines';
import { UNASSIGNED_LANE_KEY } from '@shared/data-access';
import { PageHeaderComponent } from '@shared/ui';
import {
  CatalogFilters,
  CatalogFiltersComponent,
  EMPTY_FILTERS,
  SortDirection,
} from '../../../app/catalog/catalog-filters.component';
import {
  CatalogTimelineComponent,
  TimelineLaneDescriptor,
} from '../../../app/catalog/catalog-timeline.component';
import timelineEn from '../i18n/en.json';
import timelineUk from '../i18n/uk.json';

@Component({
  selector: 'app-timeline-page',
  imports: [
    CatalogFiltersComponent,
    CatalogTimelineComponent,
    PageHeaderComponent,
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
          <app-catalog-filters
            [value]="filters()"
            [showPlotlineFilter]="true"
            [showCharacterFilter]="false"
            [showPlaceFilter]="false"
            [showSortControl]="true"
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

  protected readonly filters = signal<CatalogFilters>(EMPTY_FILTERS);
  protected readonly sortDirection = signal<SortDirection>('desc');
  protected readonly EMPTY_FILTERS = EMPTY_FILTERS;

  /**
   * Translates filter selection into the lane descriptors the timeline
   * renders. No selection at all → one global lane against
   * `_timelineEntries`. Any selection (real plotlines and/or the synthetic
   * unassigned sentinel) → one lane per pick against
   * `_timelineLaneEntries`. See `docs/narrative-engine-impl.md`
   * *Timeline UX*.
   */
  protected readonly lanes = computed<TimelineLaneDescriptor[]>(() => {
    const sel = this.filters().plotlines;
    if (sel.length === 0) {
      return [{ laneKey: null, label: '' }];
    }
    const plotlines = this.plotlinesService.plotlines();
    const out: TimelineLaneDescriptor[] = [];
    for (const id of sel) {
      if (id === UNASSIGNED_LANE_KEY) {
        out.push({
          laneKey: UNASSIGNED_LANE_KEY,
          label: this.transloco.translate('catalog.field.unassigned'),
        });
        continue;
      }
      const p = plotlines.find((pl) => pl.id === id);
      if (p) {
        out.push({ laneKey: p.id, label: p.title, color: p.color });
      }
    }
    return out;
  });

  protected onFiltersChange(next: CatalogFilters): void {
    // Strip non-plotline filters — the timeline filter only acts on plotline
    // lanes; character / place filtering requires composite indexes not yet
    // authored (per backend-rules *Pagination and filtering* +
    // *Day-one combinations*).
    this.filters.set({ ...EMPTY_FILTERS, plotlines: next.plotlines });
  }
}
