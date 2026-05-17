import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * Checkbox styled as a button so it can sit alongside other filter
 * controls (`<select>`, `<app-entity-picker>`, etc.) without breaking
 * the row's vertical rhythm. The inner box doubles as the
 * keyboard-focus + on/off indicator: outlined when off, accent-filled
 * with a check glyph when on. Matches `BASE` from `button-base.ts` for
 * height, focus ring, and disabled treatment so the toggle is visually
 * peer to a regular button.
 *
 * Reach for this whenever you'd otherwise use `<input type="checkbox">`
 * inline with form controls — the native checkbox is too small and
 * breaks the row baseline.
 */
@Component({
  selector: 'app-toggle-button',
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked() ? 'true' : 'false'"
      [attr.aria-disabled]="disabled() ? 'true' : null"
      [disabled]="disabled()"
      [class]="rootClasses()"
      (click)="onClick()"
    >
      <span [class]="indicatorClasses()" aria-hidden="true">
        @if (checked()) {
          <svg
            class="size-3"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 8 7 12 13 4" />
          </svg>
        }
      </span>
      <span class="truncate">{{ label() }}</span>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleButtonComponent {
  readonly label = input.required<string>();
  readonly checked = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly checkedChange = output<boolean>();

  protected readonly rootClasses = computed(() => {
    const base =
      'inline-flex items-center gap-2 rounded-md font-medium h-10 px-3 text-sm ' +
      'transition-colors cursor-pointer select-none border ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
      'focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60';
    return this.checked()
      ? `${base} border-accent-ring bg-accent-soft text-accent-soft-foreground focus-visible:ring-accent-ring`
      : `${base} border-border-strong bg-surface text-foreground hover:bg-surface-muted focus-visible:ring-foreground-faint`;
  });

  protected readonly indicatorClasses = computed(() => {
    const base =
      'inline-flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors';
    return this.checked()
      ? `${base} border-accent-ring bg-accent text-accent-foreground`
      : `${base} border-border-strong bg-surface`;
  });

  protected onClick(): void {
    if (this.disabled()) return;
    this.checkedChange.emit(!this.checked());
  }
}
