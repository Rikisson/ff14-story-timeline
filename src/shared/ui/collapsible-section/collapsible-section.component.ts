import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';

@Component({
  selector: 'app-collapsible-section',
  template: `
    <details
      class="rounded-md border border-border bg-surface"
      [open]="open()"
      (toggle)="onToggle($event)"
    >
      <summary
        class="flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-foreground-subtle [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <svg
          class="size-4 shrink-0 text-foreground-faint transition-transform"
          [class.rotate-90]="open()"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 4 10 8 6 12" />
        </svg>
        <span>{{ title() }}</span>
      </summary>
      <div class="border-t border-border px-3 py-3">
        <ng-content />
      </div>
    </details>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollapsibleSectionComponent {
  readonly title = input.required<string>();
  readonly defaultOpen = input<boolean>(false);

  protected readonly open = linkedSignal(() => this.defaultOpen());

  protected onToggle(event: Event): void {
    this.open.set((event.target as HTMLDetailsElement).open);
  }
}
