import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeService } from '@shared/services';

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="inline-flex size-9 items-center justify-center rounded-md text-foreground-subtle
             hover:bg-surface-muted hover:text-foreground
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground-faint"
      [attr.aria-label]="ariaLabel()"
      [title]="title()"
      (click)="toggle()"
    >
      @switch (preference()) {
        @case ('light') {
          <svg
            class="size-5"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        }
        @case ('dark') {
          <svg
            class="size-5"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        }
        @default {
          <svg
            class="size-5"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        }
      }
    </button>
  `,
})
export class ThemeToggleComponent {
  private readonly theme = inject(ThemeService);

  protected readonly preference = this.theme.preference;

  protected readonly ariaLabel = computed(
    () => `Theme: ${this.preference()}. Click to change.`,
  );

  protected readonly title = computed(() => {
    switch (this.preference()) {
      case 'light':
        return 'Light theme (click for dark)';
      case 'dark':
        return 'Dark theme (click for system)';
      default:
        return 'System theme (click for light)';
    }
  });

  protected toggle(): void {
    this.theme.cycle();
  }
}
