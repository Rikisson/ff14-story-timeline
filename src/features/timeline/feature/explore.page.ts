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
import { ConnectionsService, targetEntityRef } from '@features/connections';
import { EventsService } from '@features/events';
import { PlotlinesService } from '@features/plotlines';
import { StoriesService } from '@features/stories';
import { UniverseStore } from '@features/universes';
import {
  createTimelineStreamStore,
  EntityDirectoryService,
  fetchTimelineRowsByIds,
  SortDirection,
  TimelineRow,
} from '@shared/data-access';
import { EntityRef } from '@shared/models';
import {
  ListPaneItem,
  PageComponent,
  SidePaneComponent,
  SidePaneGroup,
  SidePaneGroupedListComponent,
  SidePaneHeaderComponent,
  SidePaneSearchComponent,
} from '@shared/ui';
import { formatInGameDate } from '@shared/utils';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import {
  EMPTY_EXPLORE_FILTERS,
  ExploreFilters,
  ExploreFiltersComponent,
} from './explore-filters.component';
import {
  ExploreDetailComponent,
  ExploreDetailVm,
  ExploreReadNext,
} from '../ui/explore-detail.component';
import exploreEn from '../i18n/en.json';
import exploreUk from '../i18n/uk.json';

const rowKey = (r: { kind: string; id: string }): string => `${r.kind}:${r.id}`;

interface MemberView {
  plotlineId: string;
  title: string;
  rows: TimelineRow[];
}

/**
 * Explore — the universe home. A combined stories + events stream rendered
 * as a softly date-grouped master rail with an in-page detail pane, over
 * the `_timelineEntries` projection. Type and title search refine the loaded
 * rows client-side. Selecting a plotline switches the list to that plotline's
 * `members[]` (fetched by id), shown in authored or date order. The detail
 * pane offers a "Read next" nudge — a wired continuation, else the next
 * plotline member when a plotline is active.
 */
@Component({
  selector: 'app-explore-page',
  host: { class: 'block h-full' },
  imports: [
    ExploreDetailComponent,
    ExploreFiltersComponent,
    PageComponent,
    SidePaneComponent,
    SidePaneGroupedListComponent,
    SidePaneHeaderComponent,
    SidePaneSearchComponent,
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
        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <app-side-pane class="md:w-80 md:shrink-0" [ariaLabel]="t('tooltip.list')">
            <app-side-pane-header [title]="t('field.title')" />

            <app-side-pane-search
              [searchValue]="filters().search"
              [placeholder]="t('search.placeholder')"
              [hasFilters]="true"
              [filtersActive]="filtersActive()"
              (searchChange)="onSearchChange($event)"
            >
              <app-explore-filters
                [value]="filters()"
                [sortDirection]="sortDirection()"
                (filtersChange)="filters.set($event)"
                (sortDirectionChange)="sortDirection.set($event)"
                (reset)="filters.set(EMPTY)"
              />
            </app-side-pane-search>

            <app-side-pane-grouped-list
              [groups]="groups()"
              [selectedId]="sel()"
              [loading]="listLoading()"
              [loadingMore]="store.loadingMore()"
              [hasMore]="listHasMore()"
              [error]="store.error()"
              [ariaLabel]="t('tooltip.list')"
              [emptyMessage]="t('empty.list')"
              (select)="onSelect($event)"
              (loadMore)="store.loadMore()"
            />
          </app-side-pane>

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
  private readonly plotlines = inject(PlotlinesService);
  private readonly connections = inject(ConnectionsService);
  private readonly directory = inject(EntityDirectoryService);
  private readonly firebase = inject(FirebaseService);
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
  private readonly plotlineId = computed(() => this.filters().plotlineId);

  protected readonly detail = signal<ExploreDetailVm | null>(null);
  protected readonly detailLoading = signal(false);

  // Plotline filter switches the data source to the plotline's members.
  private readonly memberView = signal<MemberView | null>(null);
  private readonly memberLoading = signal(false);

  private readonly activeMemberView = computed<MemberView | null>(() => {
    const pid = this.filters().plotlineId;
    const mv = this.memberView();
    return pid && mv && mv.plotlineId === pid ? mv : null;
  });

  private readonly authoredView = computed(
    () => this.filters().plotlineId !== null && this.filters().plotlineOrder === 'authored',
  );

  protected readonly listLoading = computed(() =>
    this.filters().plotlineId !== null ? this.memberLoading() : this.store.loading(),
  );
  protected readonly listHasMore = computed(() =>
    this.filters().plotlineId !== null ? false : this.store.hasMore(),
  );

  private readonly visibleRows = computed<TimelineRow[]>(() => {
    const { type, plotlineId, plotlineOrder, search } = this.filters();
    const q = search.trim().toLowerCase();

    let rows: TimelineRow[];
    if (plotlineId !== null) {
      const mv = this.activeMemberView();
      rows = mv ? mv.rows : [];
      if (plotlineOrder === 'date') {
        const dir = this.sortDirection() === 'desc' ? -1 : 1;
        rows = [...rows].sort((a, b) => dir * a.dateSortKey.localeCompare(b.dateSortKey));
      }
    } else {
      rows = this.store.rows();
    }

    return rows.filter(
      (r) =>
        (type === 'all' || r.kind === type) &&
        (q === '' || r.title.toLowerCase().includes(q)),
    );
  });

  protected readonly groups = computed<SidePaneGroup[]>(() => {
    const rows = this.visibleRows();

    // Authored plotline order isn't date-monotonic, so render one flat
    // group titled by the plotline rather than scattering date headers.
    if (this.authoredView()) {
      const mv = this.activeMemberView();
      if (!mv || rows.length === 0) return [];
      return [{ key: '__authored__', label: mv.title, items: rows.map((r) => this.toItem(r)) }];
    }

    const out: SidePaneGroup[] = [];
    let current: SidePaneGroup | null = null;
    for (const r of rows) {
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
    // Load the selected plotline's members whenever the filter changes.
    let memberToken = 0;
    effect(() => {
      const pid = this.filters().plotlineId;
      const uid = this.universeId();
      const mine = ++memberToken;
      if (!pid || !uid) {
        this.memberView.set(null);
        this.memberLoading.set(false);
        return;
      }
      this.memberLoading.set(true);
      void this.loadMemberView(uid, pid).then((mv) => {
        if (mine !== memberToken) return;
        this.memberView.set(mv);
        this.memberLoading.set(false);
      });
    });

    // A monotonic token guards against out-of-order resolution when the
    // selection changes faster than the fetches settle.
    let token = 0;
    effect(() => {
      const sel = this.sel();
      // Re-resolve when the plotline context changes — it decides which
      // "Next in plotline" nudge (if any) the detail pane shows.
      this.plotlineId();
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

    // First-in-stream landing: when nothing is selected, open the first
    // visible row. `replaceUrl` keeps it out of the back stack.
    effect(() => {
      if (this.sel() || this.listLoading()) return;
      const first = this.visibleRows()[0];
      if (!first) return;
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { sel: rowKey(first) },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
  }

  private async loadMemberView(universeId: string, plotlineId: string): Promise<MemberView> {
    const plotline = await this.plotlines.getById(plotlineId);
    const members = plotline?.members ?? [];
    const rows = await fetchTimelineRowsByIds(this.firebase.firestore, universeId, members);
    return { plotlineId, title: plotline?.title ?? '', rows };
  }

  protected onSearchChange(search: string): void {
    this.filters.update((f) => ({ ...f, search }));
  }

  protected onSelect(key: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sel: key },
      queryParamsHandling: 'merge',
    });
  }

  private async loadDetail(sel: string): Promise<ExploreDetailVm | null> {
    const sep = sel.indexOf(':');
    const kind = sel.slice(0, sep);
    const id = sel.slice(sep + 1);
    if (kind !== 'story' && kind !== 'event') return null;
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
        refs: [...(s.relatedRefs ?? [])],
        readNext: await this.resolveReadNext('story', id),
      };
    }

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
      refs: [...(e.relatedRefs ?? [])],
      readNext: await this.resolveReadNext('event', id),
    };
  }

  /**
   * Forward nudge for the detail pane. Precedence: (1) a wired outbound
   * connection — "Continues in" for a single path, "Leads to" when there
   * are several; (2) the next member, in authored order, of the plotline
   * context — the active filter, or the entity's sole plotline when no
   * filter narrows it (skipped if it belongs to several). Both link into
   * the reader. Dangling targets are dropped. Any read failure (e.g. a
   * guest hitting a draft target) yields no nudge rather than an error.
   */
  private async resolveReadNext(
    kind: 'story' | 'event',
    id: string,
  ): Promise<ExploreReadNext | undefined> {
    const universeId = this.universeId();
    if (!universeId) return undefined;
    try {
      const outbound = await this.connections.outboundFor(
        { kind, id },
        { readerOnly: !this.effectiveDrafts() },
      );
      const wired = outbound.filter((c) => c.to);
      if (wired.length > 0 && wired[0].to) {
        const ref = targetEntityRef(wired[0].to);
        if (ref) {
          const [row] = await this.directory.byIds({
            universeId,
            refs: [ref],
            includeDrafts: this.effectiveDrafts(),
          });
          if (row) {
            const sceneId = wired[0].to.kind === 'story' ? wired[0].to.sceneId : undefined;
            return {
              labelKey: wired.length > 1 ? 'leadsTo' : 'continuesIn',
              title: row.label,
              link: this.readerLink(ref),
              queryParams: sceneId ? { scene: sceneId } : undefined,
            };
          }
        }
      }

      // Plotline context: the active filter, else the entity's sole plotline.
      // (Ambiguous when it belongs to several and no filter narrows it, so skip.)
      let plotline = null;
      const filterPid = this.filters().plotlineId;
      if (filterPid) {
        plotline = await this.plotlines.getById(filterPid);
      } else {
        const containing = await this.plotlines.plotlinesContaining({ kind, id });
        if (containing.length === 1) plotline = containing[0];
      }

      const members = plotline?.members ?? [];
      const idx = members.findIndex((m) => m.kind === kind && m.id === id);
      if (idx >= 0 && idx < members.length - 1) {
        const next = members[idx + 1];
        const [row] = await this.directory.byIds({
          universeId,
          refs: [next],
          includeDrafts: this.effectiveDrafts(),
        });
        if (row) {
          return { labelKey: 'nextInPlotline', title: row.label, link: this.readerLink(next) };
        }
      }
    } catch {
      // Forbidden / transient read — surface no nudge.
    }
    return undefined;
  }

  private readerLink(ref: EntityRef<'story' | 'event'>): readonly [string, string] {
    return ref.kind === 'story' ? ['/reader/story', ref.id] : ['/reader/event', ref.id];
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

  private toItem(r: TimelineRow): ListPaneItem {
    return {
      id: rowKey(r),
      label: r.title || this.transloco.translate('explore.field.untitled'),
      secondary: this.formatDate(r),
      coverAssetId: r.coverAssetId,
      kind: r.kind,
      badge: r.draft
        ? { text: this.transloco.translate('explore.badge.draft'), tone: 'amber' }
        : undefined,
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
