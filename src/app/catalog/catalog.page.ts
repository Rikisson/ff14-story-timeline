import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { CalendarService } from '@features/calendar';
import { Story, StoriesService } from '@features/stories';
import { UniverseStore } from '@features/universes';
import { isInGameDateEmpty } from '@shared/models';
import { EntityListPaneComponent, ListPaneItem, PageHeaderComponent } from '@shared/ui';
import { formatInGameDate } from '@shared/utils';
import {
  CatalogFiltersComponent,
  CatalogFilters,
  EMPTY_FILTERS,
  matchesStory,
} from './catalog-filters.component';
import { CatalogDetailComponent } from './catalog-detail.component';
import catalogEn from './i18n/en.json';
import catalogUk from './i18n/uk.json';

@Component({
  selector: 'app-catalog-page',
  host: { class: 'block h-full' },
  imports: [
    CatalogDetailComponent,
    CatalogFiltersComponent,
    EntityListPaneComponent,
    PageHeaderComponent,
    TranslocoDirective,
  ],
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
      <div class="flex h-full flex-col gap-4">
        <app-page-header
          [title]="t('field.title')"
          [subtitle]="t('message.subtitle')"
        >
          <app-catalog-filters
            [value]="filters()"
            (filtersChange)="filters.set($event)"
            (reset)="filters.set(EMPTY_FILTERS)"
          />
        </app-page-header>

        @if (actionError(); as e) {
          <p class="m-0 text-sm text-danger-foreground">{{ e }}</p>
        }

        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <app-entity-list-pane
            class="md:w-80 md:shrink-0"
            [items]="listItems()"
            [selectedId]="selectedId()"
            [hasMore]="stories.hasMore()"
            [loadingMore]="stories.loadingMore()"
            [canCreate]="canCreate()"
            [createLabel]="t('action.newStory')"
            [emptyMessage]="t('empty.list')"
            [ariaLabel]="t('tooltip.storiesList')"
            (select)="onSelect($event)"
            (create)="createStory()"
            (loadMore)="stories.loadMorePublished()"
          />

          <section class="flex min-h-0 flex-col md:flex-1" [attr.aria-label]="t('tooltip.storyDetails')">
            @if (selected(); as s) {
              <div class="min-h-0 flex-1 overflow-y-auto">
                <app-catalog-detail
                  [story]="s"
                  [canEdit]="canCreate()"
                  (remove)="deleteStory($event)"
                />
              </div>
            } @else {
              <p class="m-0 rounded-lg border border-dashed border-border-strong bg-surface-subtle px-4 py-12 text-center text-sm text-foreground-faint">
                {{ t('empty.selectStory') }}
              </p>
            }
          </section>
        </div>
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogPage {
  protected readonly stories = inject(StoriesService);
  private readonly universes = inject(UniverseStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly calendar = inject(CalendarService);
  private readonly transloco = inject(TranslocoService);
  protected readonly user = inject(AuthStore).user;

  protected readonly canCreate = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly published = this.stories.publishedStories;
  protected readonly filters = signal<CatalogFilters>(EMPTY_FILTERS);
  protected readonly creating = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly EMPTY_FILTERS = EMPTY_FILTERS;
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });
  private readonly _selectedId = signal<string | null>(null);
  protected readonly selectedId = this._selectedId.asReadonly();

  protected readonly filteredStories = computed(() => {
    const f = this.filters();
    return this.published().filter((s) => matchesStory(s, f));
  });

  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? this.published().find((s) => s.id === id) ?? null : null;
  });

  protected readonly listItems = computed<ListPaneItem[]>(() =>
    this.filteredStories().map((s) => ({
      id: s.id,
      label: s.title || this.transloco.translate('catalog.field.untitled'),
      secondary: this.formatDateLabel(s),
      coverAssetId: s.coverAssetId,
      badge: s.draft
        ? { text: this.transloco.translate('catalog.field.draft'), tone: 'amber' }
        : undefined,
    })),
  );

  private formatDateLabel(s: Story): string | undefined {
    if (isInGameDateEmpty(s.inGameDate)) return undefined;
    return (
      formatInGameDate(s.inGameDate, {
        eraName: s.inGameDate.era ? this.calendar.eraNameLookup(s.inGameDate.era) : undefined,
        monthName: s.inGameDate.month
          ? this.calendar.monthNameLookup(s.inGameDate.month)
          : undefined,
        weekdayName: this.calendar.weekdayLookup(s.inGameDate),
      }) || undefined
    );
  }

  constructor() {
    effect(() => {
      const id = this.routeId().get('id');
      this._selectedId.set(id ?? null);
    });
  }

  protected onSelect(id: string): void {
    void this.router.navigate(['/library', id]);
  }

  protected async createStory(): Promise<void> {
    const u = this.user();
    if (!u || this.creating()) return;
    this.creating.set(true);
    this.actionError.set(null);
    try {
      const id = await this.stories.createDraftStory(u.uid);
      await this.router.navigate(['/edit', id]);
    } catch (err) {
      this.actionError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.creating.set(false);
    }
  }

  protected async deleteStory(id: string): Promise<void> {
    try {
      await this.stories.deleteStory(id);
    } catch (err) {
      this.actionError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      return;
    }
    if (this.selectedId() === id) {
      void this.router.navigate(['/library']);
    }
    void this.stories.refreshPublished();
  }
}
