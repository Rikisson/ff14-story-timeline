import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CharactersService } from '@features/characters';
import { PlacesService } from '@features/places';
import { Story } from '@features/stories';
import { GhostButtonComponent } from '@shared/ui';

export interface CatalogFilters {
  character: string;
  place: string;
  inGameDate: string;
  mineOnly: boolean;
}

export const EMPTY_FILTERS: CatalogFilters = {
  character: '',
  place: '',
  inGameDate: '',
  mineOnly: false,
};

export type SortDirection = 'asc' | 'desc';

interface FilterOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-catalog-filters',
  imports: [GhostButtonComponent],
  template: `
    <div class="flex flex-wrap items-end gap-3">
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Main character</span>
        <select
          class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          [value]="value().character"
          (change)="emit('character', $event)"
        >
          <option value="">Any</option>
          @for (c of characterOptions(); track c.id) {
            <option [value]="c.id">{{ c.label }}</option>
          }
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Place</span>
        <select
          class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          [value]="value().place"
          (change)="emit('place', $event)"
        >
          <option value="">Any</option>
          @for (p of placeOptions(); track p.id) {
            <option [value]="p.id">{{ p.label }}</option>
          }
        </select>
      </label>

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">In-game date</span>
        <select
          class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          [value]="value().inGameDate"
          (change)="emit('inGameDate', $event)"
        >
          <option value="">Any</option>
          @for (d of dates(); track d) {
            <option [value]="d">{{ d }}</option>
          }
        </select>
      </label>

      @if (showSortControl()) {
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700">Sort by date</span>
          <select
            class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
            [value]="sortDirection()"
            (change)="emitSort($event)"
          >
            <option value="asc">Oldest first</option>
            <option value="desc">Newest first</option>
          </select>
        </label>
      }

      @if (showMineFilter()) {
        <label
          class="flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <input
            type="checkbox"
            [checked]="value().mineOnly"
            (change)="emitMine($event)"
          />
          My stories
        </label>
      }

      @if (hasActive()) {
        <button uiGhost type="button" (click)="reset.emit()">Clear filters</button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogFiltersComponent {
  readonly stories = input.required<Story[]>();
  readonly value = input.required<CatalogFilters>();
  readonly showMineFilter = input<boolean>(false);
  readonly showSortControl = input<boolean>(false);
  readonly sortDirection = input<SortDirection>('asc');
  readonly filtersChange = output<CatalogFilters>();
  readonly sortDirectionChange = output<SortDirection>();
  readonly reset = output<void>();

  private readonly charactersService = inject(CharactersService);
  private readonly placesService = inject(PlacesService);

  protected readonly characterOptions = computed<FilterOption[]>(() =>
    this.charactersService
      .characters()
      .map((c) => ({ id: c.id, label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );
  protected readonly placeOptions = computed<FilterOption[]>(() =>
    this.placesService
      .places()
      .map((p) => ({ id: p.id, label: p.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );
  protected readonly dates = computed(() =>
    distinctSorted(this.stories().map((s) => s.inGameDate)),
  );
  protected readonly hasActive = computed(() => {
    const v = this.value();
    return !!(v.character || v.place || v.inGameDate || v.mineOnly);
  });

  protected emit(key: 'character' | 'place' | 'inGameDate', event: Event): void {
    const next = (event.target as HTMLSelectElement).value;
    this.filtersChange.emit({ ...this.value(), [key]: next });
  }

  protected emitMine(event: Event): void {
    this.filtersChange.emit({
      ...this.value(),
      mineOnly: (event.target as HTMLInputElement).checked,
    });
  }

  protected emitSort(event: Event): void {
    const next = (event.target as HTMLSelectElement).value as SortDirection;
    this.sortDirectionChange.emit(next);
  }
}

function distinctSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
