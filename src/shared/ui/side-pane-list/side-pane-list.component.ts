import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { EntityKind } from '@shared/models';
import { GhostButtonComponent } from '../button';
import { ListPaneItem, SidePaneListItemComponent } from '../side-pane-list-item';

@Component({
  selector: 'app-side-pane-list',
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
      } @else if (items().length === 0) {
        <p class="m-0 shrink-0 px-1 py-4 text-sm italic text-foreground-faint">{{ emptyMessage() }}</p>
      } @else {
        <div class="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1">
          <ul role="listbox" class="m-0 flex list-none flex-col gap-1 p-0" [attr.aria-label]="ariaLabel()">
            @for (item of items(); track item.id) {
              <li>
                <app-side-pane-list-item
                  [item]="item"
                  [kind]="kind()"
                  [worldPlaceholder]="worldPlaceholder()"
                  [selected]="item.id === selectedId()"
                  (select)="select.emit(item.id)"
                />
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
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidePaneListComponent {
  readonly items = input.required<ListPaneItem[]>();
  // Drives the no-cover placeholder glyph for uniform lists.
  readonly kind = input<EntityKind | undefined>(undefined);
  readonly selectedId = input<string | null>(null);
  readonly hasMore = input<boolean>(false);
  readonly loadingMore = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly error = input<unknown>(null);
  readonly emptyMessage = input<string>('Nothing here yet.');
  readonly ariaLabel = input<string>('List');
  readonly worldPlaceholder = input<boolean>(false);

  readonly select = output<string>();
  readonly loadMore = output<void>();

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
