import { Directive, computed, input } from '@angular/core';
import { cn } from '@shared/utils';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium ' +
  'h-10 px-4 text-sm transition-colors cursor-pointer select-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export const BUTTON_TEMPLATE = `
  @if (loading()) {
    <span
      class="inline-block size-4 rounded-full border-2 border-current border-t-transparent animate-spin"
      aria-hidden="true"
    ></span>
  } @else {
    <ng-content select="[icon-leading]" />
  }
  <ng-content />
  @if (!loading()) {
    <ng-content select="[icon-trailing]" />
  }
`;

@Directive({
  host: {
    '[class]': 'classes()',
    '[attr.disabled]': '(disabled() || loading()) ? "" : null',
    '[attr.aria-busy]': 'loading() ? "true" : null',
  },
})
export abstract class ButtonBase {
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly className = input<string>('');

  protected abstract readonly variantClasses: string;

  protected readonly classes = computed(() =>
    cn(BASE, this.variantClasses, this.className()),
  );
}
