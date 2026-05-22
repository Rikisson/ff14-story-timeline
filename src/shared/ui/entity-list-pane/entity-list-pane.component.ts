import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { EntityKind } from '@shared/models';
import { PrimaryButtonComponent, GhostButtonComponent } from '../button';
import { EntityKindIconComponent } from '../entity-kind-icon';
import { LazyThumbComponent } from '../lazy-thumb';

export interface ListPaneItem {
  id: string;
  label: string;
  secondary?: string;
  /**
   * Asset ID to lazy-resolve via `AssetThumbResolver`. Renders a small
   * skeleton until the thumb fetches. Preferred over `thumbnailUrl`.
   */
  coverAssetId?: string;
  /** Legacy direct URL; populated when callers haven't migrated yet. */
  thumbnailUrl?: string;
  badge?: { text: string; tone?: 'amber' | 'slate' };
}

@Component({
  selector: 'app-entity-list-pane',
  imports: [
    PrimaryButtonComponent,
    GhostButtonComponent,
    LazyThumbComponent,
    EntityKindIconComponent,
    TranslocoDirective,
  ],
  host: { class: 'block min-h-0' },
  template: `
    <ng-container *transloco="let g; prefix: 'general'">
      <aside
        class="flex h-full min-h-0 flex-col gap-2 rounded-lg border border-border bg-surface p-3"
        [attr.aria-label]="ariaLabel()"
      >
        @if (canCreate()) {
          <button uiPrimary type="button" class="w-full shrink-0" (click)="create.emit()">
            {{ createLabel() }}
          </button>
        }

        @if (showError()) {
          <p class="m-0 shrink-0 px-1 py-4 text-sm text-danger-foreground" role="alert">
            {{ g('message.refreshError', { resource: ariaLabel() }) }} {{ errorMessage() }}
          </p>
        } @else if (showLoading()) {
          <p class="m-0 shrink-0 px-1 py-4 text-sm italic text-foreground-faint" aria-live="polite">
            {{ g('message.loading') }}
          </p>
        } @else if (items().length === 0) {
          <p class="m-0 shrink-0 px-1 py-4 text-sm italic text-foreground-faint">
            {{ emptyMessage() }}
          </p>
        } @else {
          <div class="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1">
            <ul role="listbox" class="m-0 flex list-none flex-col gap-1 p-0">
              @for (item of items(); track item.id) {
                <li>
                  <button
                    type="button"
                    role="option"
                    class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                    [class.bg-accent-soft]="item.id === selectedId()"
                    [class.text-accent-soft-foreground]="item.id === selectedId()"
                    [attr.aria-selected]="item.id === selectedId()"
                    (click)="select.emit(item.id)"
                  >
                    @if (item.coverAssetId) {
                      <app-lazy-thumb
                        class="size-10 shrink-0 rounded"
                        [assetId]="item.coverAssetId"
                      />
                    } @else if (item.thumbnailUrl) {
                      <img
                        [src]="item.thumbnailUrl"
                        alt=""
                        class="size-10 shrink-0 rounded object-cover"
                      />
                    } @else if (kind(); as k) {
                      <span
                        class="grid size-10 shrink-0 place-items-center rounded bg-surface-muted text-foreground-faint"
                        aria-hidden="true"
                      >
                        <app-entity-kind-icon class="size-5" [kind]="k" />
                      </span>
                    }
                    <span class="flex min-w-0 flex-1 flex-col">
                      <span class="truncate font-medium text-foreground">{{ item.label }}</span>
                      @if (item.secondary) {
                        <span class="truncate text-xs text-foreground-faint">{{ item.secondary }}</span>
                      }
                    </span>
                    @if (item.badge) {
                      <span
                        class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                        [class.bg-warning]="item.badge.tone !== 'slate'"
                        [class.text-warning-foreground]="item.badge.tone !== 'slate'"
                        [class.bg-surface-muted]="item.badge.tone === 'slate'"
                        [class.text-foreground-muted]="item.badge.tone === 'slate'"
                      >{{ item.badge.text }}</span>
                    }
                  </button>
                </li>
              }
            </ul>

            @if (hasMore()) {
              <button
                uiGhost
                type="button"
                class="w-full shrink-0"
                [disabled]="loadingMore()"
                (click)="loadMore.emit()"
              >
                {{ loadingMore() ? g('message.loading') : g('action.loadMore') }}
              </button>
            }
          </div>
        }
      </aside>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityListPaneComponent {
  readonly items = input.required<ListPaneItem[]>();
  // Drives the no-cover placeholder glyph. Left unset by non-entity
  // panes (e.g. universe settings sections), which then render no slot.
  readonly kind = input<EntityKind | undefined>(undefined);
  readonly selectedId = input<string | null>(null);
  readonly hasMore = input<boolean>(false);
  readonly loadingMore = input<boolean>(false);
  /** True while the initial / refresh fetch is in flight. */
  readonly loading = input<boolean>(false);
  /**
   * Truthy when the last fetch failed. Surfaces a generic error message.
   * Accepts `unknown` so callers can plumb a directory store's `error`
   * signal directly without stringifying.
   */
  readonly error = input<unknown>(null);
  readonly canCreate = input<boolean>(false);
  readonly createLabel = input<string>('+ New');
  readonly emptyMessage = input<string>('Nothing here yet.');
  readonly ariaLabel = input<string>('List');

  readonly select = output<string>();
  readonly create = output<void>();
  readonly loadMore = output<void>();

  // Render-state precedence: error first (terminal), then loading-with-
  // no-items, then empty-message. A list with items keeps rendering even
  // while a refresh is in flight so the user doesn't lose context.
  protected readonly showError = computed(() => this.error() != null);
  protected readonly showLoading = computed(
    () => !this.showError() && this.loading() && this.items().length === 0,
  );
  protected readonly errorMessage = computed(() => {
    const e = this.error();
    if (e == null) return '';
    if (e instanceof Error) return e.message;
    return String(e);
  });
}
