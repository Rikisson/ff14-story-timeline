import { Directive, ElementRef, computed, inject, input } from '@angular/core';
import { cn } from '@shared/utils';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium ' +
  'h-10 px-4 text-sm transition-colors cursor-pointer select-none border border-transparent ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ' +
  'inactive:bg-surface-muted inactive:text-foreground-faint inactive:border-border ' +
  'inactive:cursor-not-allowed inactive:pointer-events-none';

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
    '[attr.disabled]': 'isAnchor ? null : ((disabled() || loading()) ? "" : null)',
    '[attr.aria-disabled]': '(disabled() || loading()) ? "true" : null',
    '[attr.tabindex]': 'isAnchor && (disabled() || loading()) ? "-1" : null',
    '[attr.aria-busy]': 'loading() ? "true" : null',
  },
})
export abstract class ButtonBase {
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly className = input<string>('');

  protected abstract readonly variantClasses: string;

  protected readonly isAnchor =
    (inject(ElementRef).nativeElement as HTMLElement).tagName === 'A';

  protected readonly classes = computed(() =>
    cn(BASE, this.variantClasses, this.className()),
  );
}
