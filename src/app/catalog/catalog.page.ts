import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '@features/auth';
import { StoriesService, Story } from '@features/stories';
import { UniverseStore } from '@features/universes';
import { PrimaryButtonComponent } from '@shared/ui';
import {
  CatalogFiltersComponent,
  CatalogFilters,
  EMPTY_FILTERS,
  matchesStory,
} from './catalog-filters.component';
import { CatalogListComponent } from './catalog-list.component';

@Component({
  selector: 'app-catalog-page',
  imports: [CatalogFiltersComponent, CatalogListComponent, PrimaryButtonComponent],
  template: `
    <div class="flex flex-col gap-4">
      <h1 class="sr-only">Stories</h1>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <app-catalog-filters
          [value]="filters()"
          [showMineFilter]="!!user()"
          (filtersChange)="filters.set($event)"
          (reset)="filters.set(EMPTY_FILTERS)"
        />

        @if (canCreate()) {
          <button uiPrimary type="button" [loading]="creating()" (click)="createStory()">
            + New story
          </button>
        }
      </div>

      @if (actionError(); as e) {
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
      } @else {
        <app-catalog-list
          [stories]="filteredStories()"
          [canManage]="canCreate()"
          (remove)="deleteStory($event)"
        />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogPage {
  private readonly stories = inject(StoriesService);
  private readonly universes = inject(UniverseStore);
  private readonly router = inject(Router);
  protected readonly user = inject(AuthStore).user;

  protected readonly canCreate = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  readonly mineOnly = input<string | undefined>();

  protected readonly published = this.stories.publishedStories;
  protected readonly myStories = signal<Story[]>([]);
  protected readonly filters = signal<CatalogFilters>(EMPTY_FILTERS);
  protected readonly creating = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly EMPTY_FILTERS = EMPTY_FILTERS;

  protected readonly sourceStories = computed<Story[]>(() =>
    this.filters().mineOnly ? this.myStories() : this.published(),
  );

  protected readonly filteredStories = computed(() => {
    const f = this.filters();
    return this.sourceStories().filter((s) => matchesStory(s, f));
  });

  constructor() {
    effect(() => {
      if (this.mineOnly() === 'true') {
        this.filters.update((f) => (f.mineOnly ? f : { ...f, mineOnly: true }));
      }
    });

    effect(() => {
      const u = this.user();
      if (!u) {
        this.myStories.set([]);
        if (this.filters().mineOnly) this.filters.set({ ...this.filters(), mineOnly: false });
        return;
      }
      void this.stories.getAuthorStories(u.uid).then((list) => this.myStories.set(list));
    });
  }

  protected async createStory(): Promise<void> {
    const u = this.user();
    if (!u) return;
    this.creating.set(true);
    this.actionError.set(null);
    try {
      const id = await this.stories.createDraftStory(u.uid);
      void this.stories.getAuthorStories(u.uid).then((list) => this.myStories.set(list));
      await this.router.navigate(['/edit', id]);
    } catch (err) {
      this.actionError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.creating.set(false);
    }
  }

  protected async deleteStory(id: string): Promise<void> {
    const u = this.user();
    if (!u) return;
    try {
      await this.stories.deleteStory(id);
    } catch (err) {
      this.actionError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      return;
    }
    this.myStories.update((list) => list.filter((s) => s.id !== id));
    void this.stories.refreshPublished();
  }
}
