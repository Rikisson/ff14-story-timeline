import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthStore } from '@features/auth';
import { EventsService, TimelineEvent } from '@features/events';
import { PlotlinesService } from '@features/plotlines';
import { StoriesService, Story } from '@features/stories';
import { UniverseStore } from '@features/universes';
import { PageHeaderComponent } from '@shared/ui';
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
  imports: [CatalogFiltersComponent, CatalogTimelineComponent, PageHeaderComponent],
  template: `
    <div class="flex flex-col gap-4">
      <app-page-header
        title="Timeline"
        subtitle="Stories and events placed on the universe's calendar."
      >
        <app-catalog-filters
          [value]="filters()"
          [showPlotlineFilter]="true"
          [showSortControl]="true"
          [sortDirection]="sortDirection()"
          (filtersChange)="filters.set($event)"
          (sortDirectionChange)="sortDirection.set($event)"
          (reset)="filters.set(EMPTY_FILTERS)"
        />
      </app-page-header>

      @if (filteredStories().length === 0 && filteredEvents().length === 0) {
        <p class="text-slate-600">Nothing to show on the timeline.</p>
      } @else {
        <app-catalog-timeline
          [stories]="filteredStories()"
          [events]="filteredEvents()"
          [plotlines]="plotlines()"
          [selectedPlotlineIds]="filters().plotlines"
          [sortDirection]="sortDirection()"
          [canManage]="canCreate()"
          [storiesHasMore]="storiesService.hasMore()"
          [eventsHasMore]="eventsService.hasMore()"
          (loadMoreStories)="storiesService.loadMorePublished()"
          (loadMoreEvents)="eventsService.loadMore()"
        />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelinePage {
  protected readonly storiesService = inject(StoriesService);
  protected readonly eventsService = inject(EventsService);
  private readonly plotlinesService = inject(PlotlinesService);
  private readonly universes = inject(UniverseStore);
  protected readonly user = inject(AuthStore).user;
  protected readonly plotlines = this.plotlinesService.plotlines;

  protected readonly canCreate = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly published = this.storiesService.publishedStories;
  protected readonly allEvents = this.eventsService.events;
  protected readonly filters = signal<CatalogFilters>(EMPTY_FILTERS);
  protected readonly sortDirection = signal<SortDirection>('desc');
  protected readonly EMPTY_FILTERS = EMPTY_FILTERS;

  // The plotline filter selects which lanes the timeline renders, not which
  // items are kept — so it's intentionally stripped before per-item filtering.
  // The lane builder consumes `selectedPlotlineIds` separately.
  private readonly itemFilters = computed<CatalogFilters>(() => ({
    ...this.filters(),
    plotlines: [],
  }));

  protected readonly filteredStories = computed<Story[]>(() =>
    this.published().filter((s) => matchesStory(s, this.itemFilters())),
  );

  protected readonly filteredEvents = computed<TimelineEvent[]>(() =>
    this.allEvents().filter((e) => matchesEvent(e, this.itemFilters())),
  );
}
