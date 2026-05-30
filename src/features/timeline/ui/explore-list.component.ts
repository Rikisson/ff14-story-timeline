import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { TimelineRow } from '@shared/data-access';
import {
  EntityKindIconComponent,
  GhostButtonComponent,
  LazyThumbComponent,
} from '@shared/ui';
import exploreEn from '../i18n/en.json';
import exploreUk from '../i18n/uk.json';

export interface ExploreItemVm {
  row: TimelineRow;
  /** `kind:id`, used for selection matching. */
  key: string;
  title: string;
  /** Pre-formatted in-game date, or '' when unknown. */
  date: string;
}

export interface ExploreGroup {
  key: string;
  label: string;
  items: ExploreItemVm[];
}

/**
 * Master rail for Explore: the combined story+event stream as a softly
 * date-grouped list, styled to match `EntityListPane`. Owns the search box
 * and a toggle that reveals the projected filter controls; grouping and
 * date formatting happen in the page.
 */
@Component({
  selector: 'app-explore-list',
  host: { class: 'block min-h-0' },
  imports: [
    EntityKindIconComponent,
    GhostButtonComponent,
    LazyThumbComponent,
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
      <ng-container *transloco="let g; prefix: 'general'">
        <aside
          class="flex h-full min-h-0 flex-col gap-2 rounded-lg border border-border bg-surface p-3"
          [attr.aria-label]="t('tooltip.list')"
        >
          <div class="flex shrink-0 items-center gap-2">
            <label class="min-w-0 flex-1">
              <span class="sr-only">{{ t('search.placeholder') }}</span>
              <input
                type="search"
                [value]="search()"
                (input)="onSearch($event)"
                [placeholder]="t('search.placeholder')"
                class="h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground"
              />
            </label>
            <button
              type="button"
              class="relative grid size-9 shrink-0 place-items-center rounded-md border border-border-strong text-foreground-subtle transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
              [class.bg-surface-muted]="expanded()"
              [attr.aria-expanded]="expanded()"
              aria-controls="explore-filter-panel"
              [attr.aria-label]="t('action.filters')"
              (click)="expanded.set(!expanded())"
            >
              <svg
                viewBox="0 0 24 24"
                class="size-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M4 5h16M7 12h10M10 19h4" />
              </svg>
              @if (filtersActive()) {
                <span class="absolute right-1 top-1 size-1.5 rounded-full bg-accent" aria-hidden="true"></span>
              }
            </button>
          </div>

          @if (expanded()) {
            <div
              id="explore-filter-panel"
              class="shrink-0 rounded-md border border-border bg-surface-subtle p-3"
            >
              <ng-content select="[explore-filters]" />
            </div>
          }

          @if (loading() && isEmpty()) {
            <p class="m-0 shrink-0 px-1 py-4 text-sm italic text-foreground-faint" aria-live="polite">
              {{ g('message.loading') }}
            </p>
          } @else if (error()) {
            <p class="m-0 shrink-0 px-1 py-4 text-sm text-danger-foreground" role="alert">
              {{ g('message.refreshError', { resource: t('tooltip.list') }) }}
              <button
                type="button"
                class="ml-2 rounded border border-border px-2 py-0.5 text-xs"
                (click)="retry.emit()"
              >{{ g('action.retry') }}</button>
            </p>
          } @else if (isEmpty()) {
            <p class="m-0 shrink-0 px-1 py-4 text-sm italic text-foreground-faint">{{ t('empty.list') }}</p>
          } @else {
            <div class="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1">
              @for (group of groups(); track group.key) {
                <div>
                  <h3
                    class="sticky top-0 z-10 m-0 bg-surface/95 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-foreground-faint backdrop-blur"
                  >{{ group.label }}</h3>
                  <ul role="listbox" class="m-0 flex list-none flex-col gap-1 p-0">
                    @for (item of group.items; track item.key) {
                      <li>
                        <button
                          type="button"
                          role="option"
                          [attr.aria-selected]="item.key === selectedKey()"
                          [class]="itemClass(item.key === selectedKey())"
                          (click)="select.emit(item.row)"
                        >
                          @if (item.row.coverAssetId) {
                            <app-lazy-thumb class="size-10 shrink-0 rounded" [assetId]="item.row.coverAssetId" />
                          } @else {
                            <span
                              class="grid size-10 shrink-0 place-items-center rounded bg-surface-muted text-foreground-faint"
                              aria-hidden="true"
                            >
                              <app-entity-kind-icon class="size-5" [kind]="item.row.kind" />
                            </span>
                          }
                          <span class="flex min-w-0 flex-1 flex-col">
                            <span class="truncate font-medium text-foreground">{{ item.title }}</span>
                            @if (item.date) {
                              <span class="truncate text-xs text-foreground-faint">{{ item.date }}</span>
                            }
                          </span>
                          @if (item.row.draft) {
                            <span
                              class="shrink-0 rounded-full bg-warning px-2 py-0.5 text-[10px] font-semibold uppercase text-warning-foreground"
                            >{{ draftLabel() }}</span>
                          }
                        </button>
                      </li>
                    }
                  </ul>
                </div>
              }

              @if (hasMore()) {
                <button
                  uiGhost
                  type="button"
                  class="w-full shrink-0"
                  [disabled]="loadingMore()"
                  (click)="loadMore.emit()"
                >{{ loadingMore() ? g('message.loading') : t('action.loadMore') }}</button>
              }
            </div>
          }
        </aside>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExploreListComponent {
  readonly groups = input.required<ExploreGroup[]>();
  readonly selectedKey = input<string | null>(null);
  readonly search = input<string>('');
  readonly filtersActive = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly loadingMore = input<boolean>(false);
  readonly hasMore = input<boolean>(false);
  readonly error = input<unknown>(null);
  readonly draftLabel = input<string>('Draft');

  readonly select = output<TimelineRow>();
  readonly searchChange = output<string>();
  readonly loadMore = output<void>();
  readonly retry = output<void>();

  protected readonly expanded = signal(false);
  protected readonly isEmpty = computed(() => this.groups().length === 0);

  protected onSearch(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }

  protected itemClass(active: boolean): string {
    const base =
      'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring';
    return active
      ? `${base} bg-accent-soft text-accent-soft-foreground`
      : `${base} hover:bg-surface-muted`;
  }
}
