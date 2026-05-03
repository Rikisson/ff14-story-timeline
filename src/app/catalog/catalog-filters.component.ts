import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CharactersService } from '@features/characters';
import { TimelineEvent } from '@features/events';
import { PlacesService } from '@features/places';
import { Story } from '@features/stories';
import { ComboboxOption, ComboboxPickerComponent, GhostButtonComponent } from '@shared/ui';

export interface CatalogFilters {
  characters: string[];
  places: string[];
  mineOnly: boolean;
}

export const EMPTY_FILTERS: CatalogFilters = {
  characters: [],
  places: [],
  mineOnly: false,
};

export type SortDirection = 'asc' | 'desc';

type ArrayKey = 'characters' | 'places';

export function matchesStory(story: Story, f: CatalogFilters): boolean {
  if (
    f.characters.length &&
    !story.mainCharacters.some((r) => f.characters.includes(r.id))
  ) {
    return false;
  }
  if (f.places.length && !story.places.some((r) => f.places.includes(r.id))) return false;
  return true;
}

export function matchesEvent(
  event: TimelineEvent,
  f: CatalogFilters,
  uid: string | null,
): boolean {
  if (f.mineOnly && (!uid || event.authorUid !== uid)) return false;
  if (
    f.characters.length &&
    !event.mainCharacters.some((r) => f.characters.includes(r.id))
  ) {
    return false;
  }
  if (f.places.length && !event.places.some((r) => f.places.includes(r.id))) return false;
  return true;
}

@Component({
  selector: 'app-catalog-filters',
  imports: [GhostButtonComponent, ComboboxPickerComponent],
  template: `
    <div class="flex flex-wrap items-start gap-4">
      <label class="flex w-60 flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Main character</span>
        <app-combobox-picker
          [options]="characterOptions()"
          [value]="value().characters"
          placeholder="Search characters…"
          emptyMessage="No characters yet."
          (valueChange)="setKey('characters', $event)"
        />
      </label>

      <label class="flex w-60 flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Place</span>
        <app-combobox-picker
          [options]="placeOptions()"
          [value]="value().places"
          placeholder="Search places…"
          emptyMessage="No places yet."
          (valueChange)="setKey('places', $event)"
        />
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
  readonly value = input.required<CatalogFilters>();
  readonly showMineFilter = input<boolean>(false);
  readonly showSortControl = input<boolean>(false);
  readonly sortDirection = input<SortDirection>('asc');
  readonly filtersChange = output<CatalogFilters>();
  readonly sortDirectionChange = output<SortDirection>();
  readonly reset = output<void>();

  private readonly charactersService = inject(CharactersService);
  private readonly placesService = inject(PlacesService);

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
  protected readonly hasActive = computed(() => {
    const v = this.value();
    return v.characters.length > 0 || v.places.length > 0 || v.mineOnly;
  });

  protected setKey(key: ArrayKey, next: string[]): void {
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
