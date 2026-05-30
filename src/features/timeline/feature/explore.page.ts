import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { CalendarService } from '@features/calendar';
import { EventsService } from '@features/events';
import { StoriesService } from '@features/stories';
import { UniverseStore } from '@features/universes';
import { createTimelineStreamStore, SortDirection, TimelineRow } from '@shared/data-access';
import { EntityRef } from '@shared/models';
import { PageComponent, PageHeaderComponent } from '@shared/ui';
import { formatInGameDate } from '@shared/utils';
import {
  EMPTY_EXPLORE_FILTERS,
  ExploreFilters,
  ExploreFiltersComponent,
} from './explore-filters.component';
import {
  ExploreGroup,
  ExploreItemVm,
  ExploreListComponent,
} from '../ui/explore-list.component';
import { ExploreDetailComponent, ExploreDetailVm } from '../ui/explore-detail.component';
import exploreEn from '../i18n/en.json';
import exploreUk from '../i18n/uk.json';

const rowKey = (r: { kind: string; id: string }): string => `${r.kind}:${r.id}`;

/**
 * Explore — the universe home. A combined stories + events stream rendered
 * as a softly date-grouped master rail with an in-page detail pane, over
 * the `_timelineEntries` projection. Type, plotline, and search refine the
 * loaded rows client-side; server-side plotline filtering returns with the
 * plotlines rework (it needs a `plotlineIds` array-contains index).
 */
@Component({
  selector: 'app-explore-page',
  host: { class: 'block h-full' },
  imports: [
    ExploreDetailComponent,
    ExploreFiltersComponent,
    ExploreListComponent,
    PageComponent,
    PageHeaderComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'explore',
      loader: {
        en: () => Promise.resolve(exploreEn),
        uk: () => Promise.resolve(exploreUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'explore'">
      <app-page class="h-full">
        <app-page-header [title]="t('field.title')" />

        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <app-explore-list
            class="md:w-80 md:shrink-0"
            [groups]="groups()"
            [selectedKey]="sel()"
            [search]="filters().search"
            [filtersActive]="filtersActive()"
            [loading]="store.loading()"
            [loadingMore]="store.loadingMore()"
            [hasMore]="store.hasMore()"
            [error]="store.error()"
            [draftLabel]="t('badge.draft')"
            (searchChange)="onSearchChange($event)"
            (select)="onSelect($event)"
            (loadMore)="store.loadMore()"
            (retry)="store.refresh()"
          >
            <app-explore-filters
              explore-filters
              [value]="filters()"
              [sortDirection]="sortDirection()"
              (filtersChange)="filters.set($event)"
              (sortDirectionChange)="sortDirection.set($event)"
              (reset)="filters.set(EMPTY)"
            />
          </app-explore-list>

          <section class="flex min-h-0 flex-col md:flex-1" [attr.aria-label]="t('tooltip.details')">
            @if (detailLoading()) {
              <p
                class="m-0 rounded-lg border border-border bg-surface-subtle px-4 py-12 text-center text-sm text-foreground-faint"
                aria-live="polite"
              >{{ t('message.loading') }}</p>
            } @else if (detail(); as d) {
              <app-explore-detail class="min-h-0 flex-1" [vm]="d" />
            } @else if (sel()) {
              <p class="m-0 rounded-lg border border-border bg-surface-subtle px-4 py-12 text-center text-sm text-foreground-faint">
                {{ t('empty.notFound') }}
              </p>
            } @else {
              <p class="m-0 rounded-lg border border-border bg-surface-subtle px-4 py-12 text-center text-sm text-foreground-faint">
                {{ t('empty.selectDetail') }}
              </p>
            }
          </section>
        </div>
      </app-page>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplorePage {
  private readonly universes = inject(UniverseStore);
  private readonly auth = inject(AuthStore);
  private readonly stories = inject(StoriesService);
  private readonly events = inject(EventsService);
  private readonly calendar = inject(CalendarService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly EMPTY = EMPTY_EXPLORE_FILTERS;
  protected readonly filters = signal<ExploreFilters>(EMPTY_EXPLORE_FILTERS);
  protected readonly sortDirection = signal<SortDirection>('asc');

  protected readonly filtersActive = computed(() => {
    const f = this.filters();
    return f.type !== 'all' || f.plotlineId !== null;
  });

  private readonly universeId = computed(() => this.universes.activeUniverseId());
  // Members may see drafts; guests are restricted to public rows by the
  // Firestore rule, so derive from membership rather than hard-coding.
  private readonly effectiveDrafts = computed(
    () => !!this.auth.user() && this.universes.isMemberOfActive(),
  );
  protected readonly store = createTimelineStreamStore({
    universeId: this.universeId,
    includeDrafts: this.effectiveDrafts,
    sortDirection: this.sortDirection,
  });

  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly sel = computed(() => this.queryParams().get('sel'));

  protected readonly detail = signal<ExploreDetailVm | null>(null);
  protected readonly detailLoading = signal(false);

  private readonly visibleRows = computed<TimelineRow[]>(() => {
    const { type, plotlineId, search } = this.filters();
    const q = search.trim().toLowerCase();
    return this.store
      .rows()
      .filter(
        (r) =>
          (type === 'all' || r.kind === type) &&
          (plotlineId === null || r.plotlineIds.includes(plotlineId)) &&
          (q === '' || r.title.toLowerCase().includes(q)),
      );
  });

  protected readonly groups = computed<ExploreGroup[]>(() => {
    const out: ExploreGroup[] = [];
    let current: ExploreGroup | null = null;
    for (const r of this.visibleRows()) {
      const key = this.groupKey(r);
      if (!current || current.key !== key) {
        current = { key, label: this.groupLabel(r), items: [] };
        out.push(current);
      }
      current.items.push(this.toItem(r));
    }
    return out;
  });

  constructor() {
    // A monotonic token guards against out-of-order resolution when the
    // selection changes faster than the fetches settle.
    let token = 0;
    effect(() => {
      const sel = this.sel();
      const my = ++token;
      if (!sel) {
        this.detail.set(null);
        this.detailLoading.set(false);
        return;
      }
      this.detailLoading.set(true);
      void this.loadDetail(sel).then((vm) => {
        if (my !== token) return;
        this.detail.set(vm);
        this.detailLoading.set(false);
      });
    });
  }

  protected onSearchChange(search: string): void {
    this.filters.update((f) => ({ ...f, search }));
  }

  protected onSelect(row: TimelineRow): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sel: rowKey(row) },
      queryParamsHandling: 'merge',
    });
  }

  private async loadDetail(sel: string): Promise<ExploreDetailVm | null> {
    const sep = sel.indexOf(':');
    const kind = sel.slice(0, sep);
    const id = sel.slice(sep + 1);
    if (!id) return null;
    if (kind === 'story') {
      const s = await this.stories.getStory(id);
      if (!s) return null;
      return {
        kind: 'story',
        id,
        title: s.title,
        description: s.description,
        coverAssetId: s.coverAssetId,
        inGameDate: s.inGameDate,
        draft: s.draft,
        refs: [...(s.plotlineRefs ?? []), ...(s.relatedRefs ?? [])],
      };
    }
    if (kind === 'event') {
      const e = await this.events.getById(id);
      if (!e) return null;
      return {
        kind: 'event',
        id,
        title: e.name,
        description: e.description,
        coverAssetId: e.coverAssetId,
        inGameDate: e.inGameDate,
        draft: false,
        refs: [...(e.plotlineRefs ?? []), ...(e.relatedRefs ?? [])],
      };
    }
    return null;
  }

  private groupKey(r: TimelineRow): string {
    if (!r.dateKnown) return '__undated__';
    const d = r.inGameDate;
    return `${d.era ?? ''}:${d.year ?? ''}`;
  }

  private groupLabel(r: TimelineRow): string {
    if (!r.dateKnown) return this.transloco.translate('explore.group.undated');
    const d = r.inGameDate;
    const parts: string[] = [];
    const era = d.era ? this.calendar.eraNameLookup(d.era) : undefined;
    if (era) parts.push(era);
    if (d.year != null) parts.push(String(d.year));
    return parts.length ? parts.join(' ') : this.transloco.translate('explore.group.undated');
  }

  private toItem(r: TimelineRow): ExploreItemVm {
    return {
      row: r,
      key: rowKey(r),
      title: r.title || this.transloco.translate('explore.field.untitled'),
      date: this.formatDate(r),
    };
  }

  private formatDate(r: TimelineRow): string {
    if (!r.dateKnown) return '';
    const d = r.inGameDate;
    return formatInGameDate(d, {
      eraName: d.era ? this.calendar.eraNameLookup(d.era) : undefined,
      monthName: d.month ? this.calendar.monthNameLookup(d.month) : undefined,
      weekdayName: this.calendar.weekdayLookup(d),
    });
  }
}
