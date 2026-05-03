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
  template: `
    <aside
      class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3"
      [attr.aria-label]="ariaLabel()"
    >
      @if (canCreate()) {
        <button uiPrimary type="button" class="w-full" (click)="create.emit()">
          {{ createLabel() }}
        </button>
      }

      @if (items().length === 0) {
        <p class="m-0 px-1 py-4 text-sm italic text-slate-500">{{ emptyMessage() }}</p>
      } @else {
        <ul role="listbox" class="m-0 flex list-none flex-col gap-1 p-0">
          @for (item of items(); track item.id) {
            <li>
              <button
                type="button"
                role="option"
                class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                [class.bg-indigo-50]="item.id === selectedId()"
                [class.text-indigo-900]="item.id === selectedId()"
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
                  <span class="truncate font-medium text-slate-900">{{ item.label }}</span>
                  @if (item.secondary) {
                    <span class="truncate text-xs text-slate-500">{{ item.secondary }}</span>
                  }
                </span>
                @if (item.badge) {
                  <span
                    class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                    [class.bg-amber-100]="item.badge.tone !== 'slate'"
                    [class.text-amber-800]="item.badge.tone !== 'slate'"
                    [class.bg-slate-100]="item.badge.tone === 'slate'"
                    [class.text-slate-700]="item.badge.tone === 'slate'"
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
            class="w-full"
            [disabled]="loadingMore()"
            (click)="loadMore.emit()"
          >
            {{ loadingMore() ? 'Loading…' : 'View more' }}
          </button>
        }
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
