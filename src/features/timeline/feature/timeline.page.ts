import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthStore } from '@features/auth';
import { EventsService, TimelineEvent } from '@features/events';
import { StoriesService, Story } from '@features/stories';
import { UniverseStore } from '@features/universes';
import {
  CatalogFilters,
  CatalogFiltersComponent,
  EMPTY_FILTERS,
  SortDirection,
  matchesEvent,
  matchesStory,
} from '../../../app/catalog/catalog-filters.component';
import { CatalogTimelineComponent } from '../../../app/catalog/catalog-timeline.component';

@Component({
  selector: 'app-timeline-page',
  imports: [CatalogFiltersComponent, CatalogTimelineComponent],
  template: `
    <div class="flex flex-col gap-4">
      <h1 class="m-0 text-2xl font-semibold text-slate-900">Timeline</h1>
      <p class="m-0 text-sm text-slate-600">
        Stories and events placed on the universe's calendar.
      </p>

      <app-catalog-filters
        [value]="filters()"
        [showMineFilter]="!!user()"
        [showSortControl]="true"
        [sortDirection]="sortDirection()"
        (filtersChange)="filters.set($event)"
        (sortDirectionChange)="sortDirection.set($event)"
        (reset)="filters.set(EMPTY_FILTERS)"
      />

      @if (filteredStories().length === 0 && filteredEvents().length === 0) {
        <p class="text-slate-600">Nothing to show on the timeline.</p>
      } @else {
        <app-catalog-timeline
          [stories]="filteredStories()"
          [events]="filteredEvents()"
          [sortDirection]="sortDirection()"
          [canManage]="canCreate()"
        />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelinePage {
  private readonly stories = inject(StoriesService);
  private readonly events = inject(EventsService);
  private readonly universes = inject(UniverseStore);
  protected readonly user = inject(AuthStore).user;

  protected readonly canCreate = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly published = this.stories.publishedStories;
  protected readonly allEvents = this.events.events;
  protected readonly filters = signal<CatalogFilters>(EMPTY_FILTERS);
  protected readonly sortDirection = signal<SortDirection>('desc');
  protected readonly EMPTY_FILTERS = EMPTY_FILTERS;

  protected readonly filteredStories = computed<Story[]>(() => {
    const f = this.filters();
    const uid = this.user()?.uid ?? null;
    return this.published().filter((s) => {
      if (f.mineOnly && (!uid || s.authorUid !== uid)) return false;
      return matchesStory(s, f);
    });
  });

  protected readonly filteredEvents = computed<TimelineEvent[]>(() => {
    const f = this.filters();
    const uid = this.user()?.uid ?? null;
    return this.allEvents().filter((e) => matchesEvent(e, f, uid));
  });
}
