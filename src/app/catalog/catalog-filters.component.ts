import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
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

@Component({
  selector: 'app-catalog-filters',
  imports: [GhostButtonComponent],
  template: `
    <div class="flex flex-wrap items-end gap-3">
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

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700">Main character</span>
        <select
          class="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          [value]="value().character"
          (change)="emit('character', $event)"
        >
          <option value="">Any</option>
          @for (c of characters(); track c) {
            <option [value]="c">{{ c }}</option>
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
          @for (p of places(); track p) {
            <option [value]="p">{{ p }}</option>
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
  readonly filtersChange = output<CatalogFilters>();
  readonly reset = output<void>();

  protected readonly characters = computed(() =>
    distinctSorted(this.stories().flatMap((s) => s.mainCharacters)),
  );
  protected readonly places = computed(() =>
    distinctSorted(this.stories().flatMap((s) => s.places)),
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
}

function distinctSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
