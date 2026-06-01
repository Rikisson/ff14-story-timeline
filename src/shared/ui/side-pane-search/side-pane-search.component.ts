import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-side-pane-search',
  imports: [TranslocoDirective],
  host: { class: 'block shrink-0' },
  template: `
    <ng-container *transloco="let g; prefix: 'general'">
      <div class="flex items-center gap-2">
        <label class="min-w-0 flex-1">
          <span class="sr-only">{{ g('action.search') }}</span>
          <input
            type="search"
            class="h-9 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-foreground placeholder:text-foreground-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
            [value]="searchValue()"
            [placeholder]="placeholder() || g('action.search')"
            [attr.aria-label]="g('action.search')"
            (input)="onSearch($event)"
          />
        </label>

        @if (hasFilters()) {
          <button
            type="button"
            class="relative grid size-9 shrink-0 place-items-center rounded-md border border-border-strong text-foreground-subtle transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
            [class.bg-surface-muted]="expanded()"
            [attr.aria-expanded]="expanded()"
            aria-controls="side-pane-filter-panel"
            [attr.aria-label]="g('action.filters')"
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
        }
      </div>

      @if (hasFilters() && expanded()) {
        <div
          id="side-pane-filter-panel"
          class="mt-2 rounded-md border border-border bg-surface-subtle p-3"
        >
          <ng-content />
        </div>
      }
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidePaneSearchComponent {
  readonly searchValue = input<string>('');
  readonly placeholder = input<string>('');
  readonly hasFilters = input<boolean>(false);
  readonly filtersActive = input<boolean>(false);

  readonly searchChange = output<string>();

  protected readonly expanded = signal(false);

  protected onSearch(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }
}
