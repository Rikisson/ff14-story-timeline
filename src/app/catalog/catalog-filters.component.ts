import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { CharactersService } from '@features/characters';
import { TimelineEvent } from '@features/events';
import { PlacesService } from '@features/places';
import { PlotlinesService } from '@features/plotlines';
import { Story } from '@features/stories';
import { ComboboxOption, ComboboxPickerComponent, GhostButtonComponent } from '@shared/ui';
import catalogEn from './i18n/en.json';
import catalogUk from './i18n/uk.json';

export interface CatalogFilters {
  characters: string[];
  places: string[];
  plotlines: string[];
}

export const EMPTY_FILTERS: CatalogFilters = {
  characters: [],
  places: [],
  plotlines: [],
};

export type SortDirection = 'asc' | 'desc';

type ArrayKey = 'characters' | 'places' | 'plotlines';

export function matchesStory(story: Story, f: CatalogFilters): boolean {
  const refs = story.relatedRefs ?? [];
  if (
    f.characters.length &&
    !refs.some((r) => r.kind === 'character' && f.characters.includes(r.id))
  ) {
    return false;
  }
  if (
    f.places.length &&
    !refs.some((r) => r.kind === 'place' && f.places.includes(r.id))
  ) {
    return false;
  }
  if (
    f.plotlines.length &&
    !(story.plotlineRefs ?? []).some((r) => f.plotlines.includes(r.id))
  ) {
    return false;
  }
  return true;
}

export function matchesEvent(event: TimelineEvent, f: CatalogFilters): boolean {
  const refs = event.relatedRefs ?? [];
  if (
    f.characters.length &&
    !refs.some((r) => r.kind === 'character' && f.characters.includes(r.id))
  ) {
    return false;
  }
  if (
    f.places.length &&
    !refs.some((r) => r.kind === 'place' && f.places.includes(r.id))
  ) {
    return false;
  }
  if (
    f.plotlines.length &&
    !(event.plotlineRefs ?? []).some((r) => f.plotlines.includes(r.id))
  ) {
    return false;
  }
  return true;
}

@Component({
  selector: 'app-catalog-filters',
  imports: [GhostButtonComponent, ComboboxPickerComponent, TranslocoDirective],
  providers: [
    provideTranslocoScope({
      scope: 'catalog',
      loader: {
        en: () => Promise.resolve(catalogEn),
        uk: () => Promise.resolve(catalogUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'catalog'">
      <div class="flex flex-wrap items-start gap-4">
        <label class="flex w-60 flex-col text-sm">
          <span class="sr-only">{{ t('field.mainCharacter') }}</span>
          <app-combobox-picker
            [options]="characterOptions()"
            [value]="value().characters"
            [placeholder]="t('empty.searchCharacters')"
            [emptyMessage]="t('empty.noCharacters')"
            (valueChange)="setKey('characters', $event)"
          />
        </label>

        <label class="flex w-60 flex-col text-sm">
          <span class="sr-only">{{ t('field.place') }}</span>
          <app-combobox-picker
            [options]="placeOptions()"
            [value]="value().places"
            [placeholder]="t('empty.searchPlaces')"
            [emptyMessage]="t('empty.noPlaces')"
            (valueChange)="setKey('places', $event)"
          />
        </label>

        @if (showPlotlineFilter()) {
          <label class="flex w-60 flex-col text-sm">
            <span class="sr-only">{{ t('field.plotline') }}</span>
            <app-combobox-picker
              [options]="plotlineOptions()"
              [value]="value().plotlines"
              [placeholder]="t('empty.searchPlotlines')"
              [emptyMessage]="t('empty.noPlotlines')"
              (valueChange)="setKey('plotlines', $event)"
            />
          </label>
        }

        @if (showSortControl()) {
          <label class="flex flex-col text-sm">
            <span class="sr-only">{{ t('field.sortByDate') }}</span>
            <select
              class="h-10 rounded-md border border-border-strong bg-surface text-foreground px-3 text-sm"
              [value]="sortDirection()"
              (change)="emitSort($event)"
              [attr.aria-label]="t('field.sortByDate')"
            >
              <option value="asc">{{ t('action.oldestFirst') }}</option>
              <option value="desc">{{ t('action.newestFirst') }}</option>
            </select>
          </label>
        }

        @if (hasActive()) {
          <button uiGhost type="button" class="self-end" (click)="reset.emit()">
            {{ t('action.clearFilters') }}
          </button>
        }
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogFiltersComponent {
  readonly value = input.required<CatalogFilters>();
  readonly showSortControl = input<boolean>(false);
  readonly showPlotlineFilter = input<boolean>(false);
  readonly sortDirection = input<SortDirection>('asc');
  readonly filtersChange = output<CatalogFilters>();
  readonly sortDirectionChange = output<SortDirection>();
  readonly reset = output<void>();

  private readonly charactersService = inject(CharactersService);
  private readonly placesService = inject(PlacesService);
  private readonly plotlinesService = inject(PlotlinesService);

  protected readonly characterOptions = computed<ComboboxOption[]>(() =>
    this.charactersService
      .characters()
      .map((c) => ({ id: c.id, label: c.name, kind: 'character' as const }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );
  protected readonly placeOptions = computed<ComboboxOption[]>(() =>
    this.placesService
      .places()
      .map((p) => ({ id: p.id, label: p.name, kind: 'place' as const }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );
  protected readonly plotlineOptions = computed<ComboboxOption[]>(() =>
    this.plotlinesService
      .plotlines()
      .map((p) => ({ id: p.id, label: p.title, kind: 'plotline' as const }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );
  protected readonly hasActive = computed(() => {
    const v = this.value();
    return v.characters.length > 0 || v.places.length > 0 || v.plotlines.length > 0;
  });

  protected setKey(key: ArrayKey, next: string[]): void {
    this.filtersChange.emit({ ...this.value(), [key]: next });
  }

  protected emitSort(event: Event): void {
    const next = (event.target as HTMLSelectElement).value as SortDirection;
    this.sortDirectionChange.emit(next);
  }
}
