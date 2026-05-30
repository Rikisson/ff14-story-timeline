import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { SortDirection } from '@shared/data-access';
import { EntityRef } from '@shared/models';
import { EntityPickerComponent, GhostButtonComponent } from '@shared/ui';
import exploreEn from '../i18n/en.json';
import exploreUk from '../i18n/uk.json';

export type ExploreType = 'all' | 'story' | 'event';

export interface ExploreFilters {
  type: ExploreType;
  /** Single plotline; narrows the same `_timelineEntries` stream server-side. */
  plotlineId: string | null;
  /** Free-text title match, applied client-side over loaded rows. */
  search: string;
}

export const EMPTY_EXPLORE_FILTERS: ExploreFilters = {
  type: 'all',
  plotlineId: null,
  search: '',
};

/**
 * Filter controls for Explore — type, a single plotline, and sort. Lives
 * inside the list pane's collapsible panel; search sits separately at the
 * top of the pane. Person / place / date / status filters are deferred
 * (they need composite indexes that aren't authored yet, per
 * `docs/backend-rules.md` *Pagination and filtering*).
 */
@Component({
  selector: 'app-explore-filters',
  imports: [EntityPickerComponent, GhostButtonComponent, TranslocoDirective],
  providers: [
    provideTranslocoScope({
      scope: 'explore',
      loader: {
        en: () => Promise.resolve(exploreEn),
        uk: () => Promise.resolve(exploreUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'explore'">
      <ng-container *transloco="let g; prefix: 'general'">
        <div class="flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-foreground-subtle">{{ t('filter.typeLabel') }}</span>
            <select
              class="h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground"
              [value]="value().type"
              (change)="onType($event)"
            >
              <option value="all">{{ t('filter.all') }}</option>
              <option value="story">{{ t('filter.stories') }}</option>
              <option value="event">{{ t('filter.events') }}</option>
            </select>
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-foreground-subtle">{{ g('field.plotlines') }}</span>
            <app-entity-picker
              [value]="plotlineRefs()"
              [kinds]="plotlineKinds"
              [maxSelections]="1"
              [placeholder]="g('empty.searchPlotlines')"
              (valueChange)="onPlotline($event)"
            />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-xs font-medium text-foreground-subtle">{{ t('field.sortByDate') }}</span>
            <select
              class="h-9 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-foreground"
              [value]="sortDirection()"
              (change)="onSort($event)"
            >
              <option value="asc">{{ t('action.oldestFirst') }}</option>
              <option value="desc">{{ t('action.newestFirst') }}</option>
            </select>
          </label>

          @if (hasActive()) {
            <button uiGhost type="button" class="self-start" (click)="reset.emit()">
              {{ t('action.clearFilters') }}
            </button>
          }
        </div>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExploreFiltersComponent {
  readonly value = input.required<ExploreFilters>();
  readonly sortDirection = input<SortDirection>('desc');
  readonly filtersChange = output<ExploreFilters>();
  readonly sortDirectionChange = output<SortDirection>();
  readonly reset = output<void>();

  protected readonly plotlineKinds = ['plotline'] as const;

  protected readonly plotlineRefs = computed<EntityRef[]>(() => {
    const id = this.value().plotlineId;
    return id ? [{ kind: 'plotline', id }] : [];
  });

  protected readonly hasActive = computed(() => {
    const v = this.value();
    return v.type !== 'all' || v.plotlineId !== null || v.search.trim() !== '';
  });

  protected onType(event: Event): void {
    const type = (event.target as HTMLSelectElement).value as ExploreType;
    this.filtersChange.emit({ ...this.value(), type });
  }

  protected onPlotline(refs: EntityRef[]): void {
    const id = refs.find((r) => r.kind === 'plotline')?.id ?? null;
    this.filtersChange.emit({ ...this.value(), plotlineId: id });
  }

  protected onSort(event: Event): void {
    this.sortDirectionChange.emit((event.target as HTMLSelectElement).value as SortDirection);
  }
}
