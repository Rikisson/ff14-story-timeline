import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { StoriesService, Story } from '@features/stories';
import { GhostButtonComponent, SecondaryButtonComponent } from '@shared/ui';
import {
  CatalogFiltersComponent,
  CatalogFilters,
  EMPTY_FILTERS,
} from './catalog-filters.component';
import { CatalogListComponent } from './catalog-list.component';
import { CatalogTimelineComponent } from './catalog-timeline.component';

type ViewMode = 'list' | 'timeline';

@Component({
  selector: 'app-catalog-page',
  imports: [
    CatalogFiltersComponent,
    CatalogListComponent,
    CatalogTimelineComponent,
    GhostButtonComponent,
    SecondaryButtonComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="m-0 text-2xl font-semibold text-slate-900">Catalog</h2>
        <div class="ml-auto flex gap-1 rounded-md border border-slate-200 bg-white p-1">
          @if (view() === 'list') {
            <button uiSecondary type="button" aria-pressed="true">List</button>
            <button uiGhost type="button" (click)="view.set('timeline')">Timeline</button>
          } @else {
            <button uiGhost type="button" (click)="view.set('list')">List</button>
            <button uiSecondary type="button" aria-pressed="true">Timeline</button>
          }
        </div>
      </div>

      <app-catalog-filters
        [stories]="allStories()"
        [value]="filters()"
        (change)="filters.set($event)"
        (reset)="filters.set(EMPTY_FILTERS)"
      />

      @if (allStories().length === 0) {
        <p class="text-slate-600">No stories published yet.</p>
      } @else if (filteredStories().length === 0) {
        <p class="text-slate-600">No stories match the current filters.</p>
      } @else if (view() === 'list') {
        <app-catalog-list [stories]="filteredStories()" />
      } @else {
        <app-catalog-timeline [stories]="filteredStories()" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogPage {
  protected readonly allStories = inject(StoriesService).publishedStories;
  protected readonly view = signal<ViewMode>('list');
  protected readonly filters = signal<CatalogFilters>(EMPTY_FILTERS);
  protected readonly EMPTY_FILTERS = EMPTY_FILTERS;

  protected readonly filteredStories = computed(() => {
    const f = this.filters();
    return this.allStories().filter((s) => matches(s, f));
  });
}

function matches(story: Story, f: CatalogFilters): boolean {
  if (f.character && !story.mainCharacters.includes(f.character)) return false;
  if (f.place && !story.places.includes(f.place)) return false;
  if (f.inGameDate && story.inGameDate !== f.inGameDate) return false;
  return true;
}
