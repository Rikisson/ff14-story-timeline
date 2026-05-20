import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface SegmentOption<T> {
  readonly value: T;
  readonly label: string;
}

@Component({
  selector: 'app-segmented-control',
  template: `
    <div role="radiogroup" class="flex flex-wrap gap-2" [attr.aria-label]="ariaLabel()">
      @for (option of options(); track option.value) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="option.value === value() ? 'true' : 'false'"
          [class]="optionClass(option.value === value())"
          (click)="valueChange.emit(option.value)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentedControlComponent<T> {
  readonly options = input.required<readonly SegmentOption<T>[]>();
  readonly value = input.required<T>();
  readonly ariaLabel = input.required<string>();
  readonly valueChange = output<T>();

  protected optionClass(active: boolean): string {
    const base =
      'inline-flex items-center justify-center rounded-md border h-9 px-3 text-sm transition-colors ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';
    return active
      ? `${base} border-accent-ring bg-accent-soft text-accent-soft-foreground focus-visible:ring-accent-ring`
      : `${base} border-border-strong bg-surface text-foreground hover:bg-surface-muted focus-visible:ring-foreground-faint`;
  }
}
