import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PrimaryButtonComponent, GhostButtonComponent } from '../button';

export interface ListPaneItem {
  id: string;
  label: string;
  secondary?: string;
  thumbnailUrl?: string;
  badge?: { text: string; tone?: 'amber' | 'slate' };
}

@Component({
  selector: 'app-entity-list-pane',
  imports: [PrimaryButtonComponent, GhostButtonComponent],
  host: { class: 'block min-h-0' },
  template: `
    <aside
      class="flex h-full min-h-0 flex-col gap-2 rounded-lg border border-border bg-surface p-3"
      [attr.aria-label]="ariaLabel()"
    >
      @if (canCreate()) {
        <button uiPrimary type="button" class="w-full shrink-0" (click)="create.emit()">
          {{ createLabel() }}
        </button>
      }

      @if (items().length === 0) {
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
                  @if (item.thumbnailUrl) {
                    <img
                      [src]="item.thumbnailUrl"
                      alt=""
                      class="size-10 shrink-0 rounded object-cover"
                    />
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
              {{ loadingMore() ? 'Loading…' : 'View more' }}
            </button>
          }
        </div>
      }
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityListPaneComponent {
  readonly items = input.required<ListPaneItem[]>();
  readonly selectedId = input<string | null>(null);
  readonly hasMore = input<boolean>(false);
  readonly loadingMore = input<boolean>(false);
  readonly canCreate = input<boolean>(false);
  readonly createLabel = input<string>('+ New');
  readonly emptyMessage = input<string>('Nothing here yet.');
  readonly ariaLabel = input<string>('List');

  readonly select = output<string>();
  readonly create = output<void>();
  readonly loadMore = output<void>();
}
