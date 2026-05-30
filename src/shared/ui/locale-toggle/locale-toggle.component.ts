import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LocaleService, type UiLocale } from '@shared/services';

@Component({
  selector: 'app-locale-toggle',
  imports: [TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *transloco="let t; prefix: 'general'">
      <button
        type="button"
        class="inline-flex h-9 cursor-pointer items-center justify-center rounded-md px-2 text-xs font-medium uppercase tracking-wide text-foreground-subtle
               hover:bg-surface-muted hover:text-foreground
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-faint"
        [attr.aria-label]="t('tooltip.localeAria', { label: currentLabel() })"
        [title]="t('tooltip.localeTitle', { current: currentLabel(), next: nextLabel() })"
        (click)="cycle()"
      >
        {{ shortCode() }}
      </button>
    </ng-container>
  `,
})
export class LocaleToggleComponent {
  private readonly locale = inject(LocaleService);

  protected readonly active = this.locale.active;

  protected readonly shortCode = computed(() => this.locale.shortFor(this.active()));

  protected readonly currentLabel = computed(() => this.locale.labelFor(this.active()));
  protected readonly nextLabel = computed(() => this.locale.labelFor(this.peekNext()));

  protected cycle(): void {
    this.locale.cycle();
  }

  private peekNext(): UiLocale {
    const supported = this.locale.supported;
    return supported[(supported.indexOf(this.active()) + 1) % supported.length];
  }
}
