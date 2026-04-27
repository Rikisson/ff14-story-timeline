import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { authFeature } from '@features/auth';
import { EventsService, TimelineEvent } from '@features/events';
import { StoriesService, Story } from '@features/stories';
import { GhostButtonComponent, PrimaryButtonComponent, SecondaryButtonComponent } from '@shared/ui';
import {
  CatalogFiltersComponent,
  CatalogFilters,
  EMPTY_FILTERS,
  SortDirection,
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
    PrimaryButtonComponent,
    SecondaryButtonComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <h1 class="sr-only">Stories</h1>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <app-catalog-filters
          [stories]="sourceStories()"
          [value]="filters()"
          [showMineFilter]="!!user()"
          [showSortControl]="view() === 'timeline'"
          [sortDirection]="sortDirection()"
          (filtersChange)="filters.set($event)"
          (sortDirectionChange)="sortDirection.set($event)"
          (reset)="filters.set(EMPTY_FILTERS)"
        />

        <div class="flex items-center gap-2">
          @if (user()) {
            <button uiPrimary type="button" [loading]="creating()" (click)="createStory()">
              + New story
            </button>
          }
          <div
            class="flex gap-1 rounded-md border border-slate-200 bg-white p-1"
            role="group"
            aria-label="View mode"
          >
            @if (view() === 'list') {
              <button uiSecondary type="button" aria-pressed="true">List</button>
              <button uiGhost type="button" aria-pressed="false" (click)="view.set('timeline')">
                Timeline
              </button>
            } @else {
              <button uiGhost type="button" aria-pressed="false" (click)="view.set('list')">
                List
              </button>
              <button uiSecondary type="button" aria-pressed="true">Timeline</button>
            }
          </div>
        </div>
      </div>

      @if (createError(); as e) {
        <p class="m-0 text-sm text-red-700">{{ e }}</p>
      }

      @if (sourceStories().length === 0) {
        <p class="text-slate-600">
          @if (filters().mineOnly) {
            You haven't created any stories yet.
          } @else {
            No stories published yet.
          }
        </p>
      } @else if (filteredStories().length === 0) {
        <p class="text-slate-600">No stories match the current filters.</p>
      } @else if (view() === 'list') {
        <app-catalog-list
          [stories]="filteredStories()"
          [currentUserUid]="user()?.uid ?? null"
        />
      } @else {
        <app-catalog-timeline
          [stories]="filteredStories()"
          [events]="filteredEvents()"
          [sortDirection]="sortDirection()"
          [currentUserUid]="user()?.uid ?? null"
        />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogPage {
  private readonly stories = inject(StoriesService);
  private readonly events = inject(EventsService);
  private readonly router = inject(Router);
  protected readonly user = inject(Store).selectSignal(authFeature.selectUser);

  protected readonly published = this.stories.publishedStories;
  protected readonly allEvents = this.events.events;
  protected readonly myStories = signal<Story[]>([]);
  protected readonly view = signal<ViewMode>('list');
  protected readonly filters = signal<CatalogFilters>(EMPTY_FILTERS);
  protected readonly sortDirection = signal<SortDirection>('asc');
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly EMPTY_FILTERS = EMPTY_FILTERS;

  protected readonly sourceStories = computed<Story[]>(() =>
    this.filters().mineOnly ? this.myStories() : this.published(),
  );

  protected readonly filteredStories = computed(() => {
    const f = this.filters();
    return this.sourceStories().filter((s) => matches(s, f));
  });

  protected readonly filteredEvents = computed<TimelineEvent[]>(() => {
    const f = this.filters();
    const uid = this.user()?.uid ?? null;
    return this.allEvents().filter((e) => matchesEvent(e, f, uid));
  });

  constructor() {
    effect((onCleanup) => {
      const u = this.user();
      if (!u) {
        this.myStories.set([]);
        if (this.filters().mineOnly) this.filters.set({ ...this.filters(), mineOnly: false });
        return;
      }
      const unsubscribe = this.stories.subscribeAuthorStories(u.uid, (list) => {
        this.myStories.set(list);
      });
      onCleanup(() => unsubscribe());
    });
  }

  protected async createStory(): Promise<void> {
    const u = this.user();
    if (!u) return;
    this.creating.set(true);
    this.createError.set(null);
    try {
      const id = await this.stories.createDraftStory(u.uid);
      await this.router.navigate(['/edit', id]);
    } catch (err) {
      this.createError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.creating.set(false);
    }
  }
}

function matches(story: Story, f: CatalogFilters): boolean {
  if (f.character && !story.mainCharacters.includes(f.character)) return false;
  if (f.place && !story.places.includes(f.place)) return false;
  if (f.inGameDate && story.inGameDate !== f.inGameDate) return false;
  return true;
}

function matchesEvent(event: TimelineEvent, f: CatalogFilters, uid: string | null): boolean {
  if (f.mineOnly && (!uid || event.authorUid !== uid)) return false;
  if (f.character && !event.mainCharacters.includes(f.character)) return false;
  if (f.place && !event.places.includes(f.place)) return false;
  if (f.inGameDate && event.inGameDate !== f.inGameDate) return false;
  return true;
}
