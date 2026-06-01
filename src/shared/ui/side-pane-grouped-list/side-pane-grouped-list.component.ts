import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { GhostButtonComponent } from '../button';
import { ListPaneItem, SidePaneListItemComponent } from '../side-pane-list-item';

export interface SidePaneGroup {
  key: string;
  label: string;
  items: ListPaneItem[];
}

@Component({
  selector: 'app-side-pane-grouped-list',
  imports: [GhostButtonComponent, SidePaneListItemComponent, TranslocoDirective],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  template: `
    <ng-container *transloco="let g; prefix: 'general'">
      @if (showError()) {
        <p class="m-0 shrink-0 px-1 py-4 text-sm text-danger-foreground" role="alert">
          {{ g('message.refreshError', { resource: ariaLabel() }) }} {{ errorMessage() }}
        </p>
      } @else if (showLoading()) {
        <p class="m-0 shrink-0 px-1 py-4 text-sm italic text-foreground-faint" aria-live="polite">
          {{ g('message.loading') }}
        </p>
      } @else if (totalItems() === 0) {
        <p class="m-0 shrink-0 px-1 py-4 text-sm italic text-foreground-faint">{{ emptyMessage() }}</p>
      } @else {
        <div class="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1">
          @for (group of groups(); track group.key) {
            <div>
              <h3
                class="sticky top-0 z-10 m-0 bg-surface/95 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-foreground-faint backdrop-blur"
              >{{ group.label }}</h3>
              <ul role="listbox" class="m-0 flex list-none flex-col gap-1 p-0" [attr.aria-label]="group.label">
                @for (item of group.items; track item.id) {
                  <li>
                    <app-side-pane-list-item
                      [item]="item"
                      [selected]="item.id === selectedId()"
                      (select)="select.emit(item.id)"
                    />
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
            >
              {{ loadingMore() ? g('message.loading') : g('action.loadMore') }}
            </button>
          }
        </div>
      }
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidePaneGroupedListComponent {
  readonly groups = input.required<SidePaneGroup[]>();
  readonly selectedId = input<string | null>(null);
  readonly hasMore = input<boolean>(false);
  readonly loadingMore = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly error = input<unknown>(null);
  readonly emptyMessage = input<string>('Nothing here yet.');
  readonly ariaLabel = input<string>('List');

  readonly select = output<string>();
  readonly loadMore = output<void>();

  protected readonly totalItems = computed(() =>
    this.groups().reduce((n, group) => n + group.items.length, 0),
  );
  protected readonly showError = computed(() => this.error() != null);
  protected readonly showLoading = computed(
    () => !this.showError() && this.loading() && this.totalItems() === 0,
  );
  protected readonly errorMessage = computed(() => {
    const e = this.error();
    if (e == null) return '';
    if (e instanceof Error) return e.message;
    return String(e);
  });
}
