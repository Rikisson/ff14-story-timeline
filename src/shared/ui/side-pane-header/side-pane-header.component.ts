import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-side-pane-header',
  host: { class: 'block shrink-0' },
  template: `
    <div class="flex items-center justify-between gap-2">
      <h1 class="m-0 min-w-0 font-display text-3xl font-semibold text-foreground">
        @if (title()) {
          <span class="block truncate">{{ title() }}</span>
        }
        <ng-content />
      </h1>

      @if (canCreate()) {
        <button
          type="button"
          class="grid size-9 shrink-0 place-items-center rounded-md border border-border-strong text-foreground-subtle transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          [attr.aria-label]="createLabel()"
          [title]="createLabel()"
          (click)="create.emit()"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidePaneHeaderComponent {
  readonly title = input<string>('');
  readonly canCreate = input<boolean>(false);
  readonly createLabel = input<string>('');

  readonly create = output<void>();
}
