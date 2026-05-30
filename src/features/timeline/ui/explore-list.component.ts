import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { TimelineRow } from '@shared/data-access';
import { GhostButtonComponent, LazyThumbComponent, TagComponent } from '@shared/ui';
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
 * Master rail for Explore: a vertical, softly date-grouped list of the
 * combined stories + events stream. Purely presentational — grouping and
 * formatting happen in the page; this renders groups and emits selection.
 */
@Component({
  selector: 'app-explore-list',
  host: { class: 'block min-h-0' },
  imports: [GhostButtonComponent, LazyThumbComponent, TagComponent, TranslocoDirective],
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
        <div class="flex h-full min-h-0 flex-col rounded-lg border border-border bg-surface-subtle">
          @if (loading() && isEmpty()) {
            <p class="m-0 px-4 py-6 text-sm italic text-foreground-faint" aria-live="polite">
              {{ g('message.loading') }}
            </p>
          } @else if (error()) {
            <p class="m-0 px-4 py-6 text-sm text-danger-foreground" role="alert">
              {{ g('message.refreshError', { resource: t('tooltip.list') }) }}
              <button
                type="button"
                class="ml-2 rounded border border-border px-2 py-0.5 text-xs"
                (click)="retry.emit()"
              >{{ g('action.retry') }}</button>
            </p>
          } @else if (isEmpty()) {
            <p class="m-0 px-4 py-6 text-sm italic text-foreground-faint">{{ t('empty.list') }}</p>
          } @else {
            <div class="min-h-0 flex-1 overflow-y-auto" [attr.aria-label]="t('tooltip.list')">
              @for (group of groups(); track group.key) {
                <section [attr.aria-label]="group.label">
                  <h3
                    class="sticky top-0 z-10 m-0 bg-surface-subtle/95 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground-faint backdrop-blur"
                  >{{ group.label }}</h3>
                  <ul role="list" class="m-0 flex list-none flex-col gap-0.5 p-2 pt-0">
                    @for (item of group.items; track item.key) {
                      <li>
                        <button
                          type="button"
                          [attr.aria-current]="item.key === selectedKey() ? 'true' : null"
                          [class]="itemClass(item.key === selectedKey())"
                          (click)="select.emit(item.row)"
                        >
                          <app-lazy-thumb class="size-11 shrink-0 rounded" [assetId]="item.row.coverAssetId" />
                          <span class="flex min-w-0 flex-1 flex-col">
                            <span class="flex items-center gap-1.5">
                              <span class="shrink-0 text-xs text-foreground-faint" aria-hidden="true">{{ item.row.kind === 'story' ? '📖' : '◆' }}</span>
                              <span class="truncate text-sm font-medium text-foreground">{{ item.title }}</span>
                            </span>
                            @if (item.date) {
                              <span class="truncate text-xs text-foreground-subtle">{{ item.date }}</span>
                            }
                          </span>
                          @if (item.row.draft) {
                            <app-tag tone="amber">{{ draftLabel() }}</app-tag>
                          }
                        </button>
                      </li>
                    }
                  </ul>
                </section>
              }

              @if (hasMore()) {
                <div class="p-3">
                  <button
                    uiGhost
                    type="button"
                    class="w-full"
                    [disabled]="loadingMore()"
                    (click)="loadMore.emit()"
                  >{{ loadingMore() ? '…' : t('action.loadMore') }}</button>
                </div>
              }
            </div>
          }
        </div>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExploreListComponent {
  readonly groups = input.required<ExploreGroup[]>();
  readonly selectedKey = input<string | null>(null);
  readonly loading = input<boolean>(false);
  readonly loadingMore = input<boolean>(false);
  readonly hasMore = input<boolean>(false);
  readonly error = input<unknown>(null);
  readonly draftLabel = input<string>('Draft');

  readonly select = output<TimelineRow>();
  readonly loadMore = output<void>();
  readonly retry = output<void>();

  protected readonly isEmpty = computed(() => this.groups().length === 0);

  protected itemClass(active: boolean): string {
    const base =
      'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ring';
    return active
      ? `${base} bg-accent-soft text-accent-soft-foreground`
      : `${base} hover:bg-surface-muted`;
  }
}
