import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CharactersService } from '@features/characters';
import { PlacesService } from '@features/places';
import { Story } from '@features/stories';
import { GhostButtonComponent } from '@shared/ui';
import { cn } from '@shared/utils';

export interface CatalogFilters {
  characters: string[];
  places: string[];
  inGameDates: string[];
  mineOnly: boolean;
}

export const EMPTY_FILTERS: CatalogFilters = {
  characters: [],
  places: [],
  inGameDates: [],
  mineOnly: false,
};

export type SortDirection = 'asc' | 'desc';

type ArrayKey = 'characters' | 'places' | 'inGameDates';

interface FilterOption {
  id: string;
  label: string;
}

@Component({
  selector: 'app-catalog-filters',
  imports: [GhostButtonComponent],
  template: `
    <div class="flex flex-wrap items-start gap-4">
      <fieldset class="flex flex-col gap-1">
        <legend class="text-sm font-medium text-slate-700">Main character</legend>
        @if (characterOptions().length === 0) {
          <p class="m-0 text-xs italic text-slate-500">No characters yet.</p>
        } @else {
          <ul class="flex max-w-md flex-wrap gap-1">
            @for (c of characterOptions(); track c.id) {
              <li>
                <button
                  type="button"
                  [attr.aria-pressed]="value().characters.includes(c.id)"
                  [class]="chipClass(value().characters.includes(c.id))"
                  (click)="toggle('characters', c.id)"
                >
                  {{ c.label }}
                </button>
              </li>
            }
          </ul>
        }
      </fieldset>

      <fieldset class="flex flex-col gap-1">
        <legend class="text-sm font-medium text-slate-700">Place</legend>
        @if (placeOptions().length === 0) {
          <p class="m-0 text-xs italic text-slate-500">No places yet.</p>
        } @else {
          <ul class="flex max-w-md flex-wrap gap-1">
            @for (p of placeOptions(); track p.id) {
              <li>
                <button
                  type="button"
                  [attr.aria-pressed]="value().places.includes(p.id)"
                  [class]="chipClass(value().places.includes(p.id))"
                  (click)="toggle('places', p.id)"
                >
                  {{ p.label }}
                </button>
              </li>
            }
          </ul>
        }
      </fieldset>

      <fieldset class="flex flex-col gap-1">
        <legend class="text-sm font-medium text-slate-700">In-game date</legend>
        @if (dates().length === 0) {
          <p class="m-0 text-xs italic text-slate-500">No dates yet.</p>
        } @else {
          <ul class="flex max-w-md flex-wrap gap-1">
            @for (d of dates(); track d) {
              <li>
                <button
                  type="button"
                  [attr.aria-pressed]="value().inGameDates.includes(d)"
                  [class]="chipClass(value().inGameDates.includes(d))"
                  (click)="toggle('inGameDates', d)"
                >
                  {{ d }}
                </button>
              </li>
            }
          </ul>
        }
      </fieldset>

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
          class="flex h-10 items-center gap-2 self-end rounded-md border border-slate-300 bg-white px-3 text-sm"
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
        <button uiGhost type="button" class="self-end" (click)="reset.emit()">
          Clear filters
        </button>
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
    return (
      v.characters.length > 0 ||
      v.places.length > 0 ||
      v.inGameDates.length > 0 ||
      v.mineOnly
    );
  });

  protected toggle(key: ArrayKey, id: string): void {
    const current = this.value()[key];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
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

  protected chipClass(active: boolean): string {
    return cn(
      'inline-flex items-center rounded-full border px-3 py-1 text-xs transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
      active
        ? 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-500'
        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
    );
  }
}

function distinctSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
