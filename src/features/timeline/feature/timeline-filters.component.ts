import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { SortDirection, UNASSIGNED_LANE_KEY } from '@shared/data-access';
import { EntityRef } from '@shared/models';
import { EntityPickerComponent, GhostButtonComponent } from '@shared/ui';
import timelineEn from '../i18n/en.json';
import timelineUk from '../i18n/uk.json';

export interface TimelineFilters {
  /** Selected plotline IDs (real plotlines only, no `__unassigned__`). */
  plotlines: string[];
  /** Synthetic `__unassigned__` lane toggle. */
  showUnassigned: boolean;
}

export const EMPTY_TIMELINE_FILTERS: TimelineFilters = {
  plotlines: [],
  showUnassigned: false,
};

/**
 * Filters strip above the timeline. Plotlines are picked through the
 * shared `EntityPicker` (directory-backed) so no per-kind preload is
 * required. Character / place filtering deliberately isn't offered —
 * those queries would need composite indexes that aren't authored yet
 * (`docs/backend-rules.md` *Pagination and filtering*).
 */
@Component({
  selector: 'app-timeline-filters',
  imports: [EntityPickerComponent, GhostButtonComponent, TranslocoDirective],
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
      <ng-container *transloco="let c; prefix: 'catalog'">
        <ng-container *transloco="let g; prefix: 'general'">
          <div class="flex flex-wrap items-end gap-4">
            <label class="flex w-60 flex-col gap-1 text-sm">
              <span class="font-medium text-foreground-muted">{{ g('field.plotlines') }}</span>
              <app-entity-picker
                [value]="plotlineRefs()"
                [kinds]="plotlineKinds"
                [placeholder]="g('empty.searchPlotlines')"
                (valueChange)="onPlotlineRefs($event)"
              />
            </label>

            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                [checked]="value().showUnassigned"
                (change)="onUnassigned($event)"
              />
              {{ c('field.unassigned') }}
            </label>

            <label class="flex flex-col text-sm">
              <span class="sr-only">{{ c('field.sortByDate') }}</span>
              <select
                class="h-10 rounded-md border border-border-strong bg-surface text-foreground px-3 text-sm"
                [value]="sortDirection()"
                (change)="onSort($event)"
                [attr.aria-label]="c('field.sortByDate')"
              >
                <option value="asc">{{ c('action.oldestFirst') }}</option>
                <option value="desc">{{ c('action.newestFirst') }}</option>
              </select>
            </label>

            @if (hasActive()) {
              <button uiGhost type="button" class="self-end" (click)="reset.emit()">
                {{ c('action.clearFilters') }}
              </button>
            }
          </div>
        </ng-container>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineFiltersComponent {
  readonly value = input.required<TimelineFilters>();
  readonly sortDirection = input<SortDirection>('asc');
  readonly filtersChange = output<TimelineFilters>();
  readonly sortDirectionChange = output<SortDirection>();
  readonly reset = output<void>();

  protected readonly plotlineKinds = ['plotline'] as const;

  protected readonly plotlineRefs = computed<EntityRef[]>(() =>
    this.value().plotlines.map((id) => ({ kind: 'plotline', id })),
  );

  protected readonly hasActive = computed(() => {
    const v = this.value();
    return v.plotlines.length > 0 || v.showUnassigned;
  });

  protected onPlotlineRefs(refs: EntityRef[]): void {
    const ids = refs.filter((r) => r.kind === 'plotline').map((r) => r.id);
    this.filtersChange.emit({ ...this.value(), plotlines: ids });
  }

  protected onUnassigned(event: Event): void {
    this.filtersChange.emit({
      ...this.value(),
      showUnassigned: (event.target as HTMLInputElement).checked,
    });
  }

  protected onSort(event: Event): void {
    this.sortDirectionChange.emit((event.target as HTMLSelectElement).value as SortDirection);
  }
}

/** Re-export so callers don't have to peek into the data-access layer. */
export { UNASSIGNED_LANE_KEY };
