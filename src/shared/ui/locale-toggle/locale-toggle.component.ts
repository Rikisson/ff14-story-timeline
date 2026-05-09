import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LocaleService, type UiLocale } from '@shared/services';

@Component({
  selector: 'app-locale-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="inline-flex h-9 items-center justify-center rounded-md px-2 text-xs font-medium uppercase tracking-wide text-foreground-subtle
             hover:bg-surface-muted hover:text-foreground
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-faint"
      [attr.aria-label]="ariaLabel()"
      [title]="title()"
      (click)="cycle()"
    >
      {{ active() }}
    </button>
  `,
})
export class LocaleToggleComponent {
  private readonly locale = inject(LocaleService);

  protected readonly active = this.locale.active;

  protected readonly ariaLabel = computed(
    () => `Language: ${this.locale.labelFor(this.active())}. Click to change.`,
  );

  protected readonly title = computed(() => {
    const next = this.nextLocale(this.active());
    return `${this.locale.labelFor(this.active())} (click for ${this.locale.labelFor(next)})`;
  });

  protected cycle(): void {
    this.locale.cycle();
  }

  private nextLocale(current: UiLocale): UiLocale {
    const supported = this.locale.supported;
    return supported[(supported.indexOf(current) + 1) % supported.length];
  }
}
