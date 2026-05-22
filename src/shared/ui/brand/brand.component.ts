import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LOCALE_META, LocaleService } from '@shared/services';

export type BrandSize = 'header' | 'hero';

@Component({
  selector: 'app-brand',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="13" cy="13" r="12" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M13 8.5C11.2 7.7 9.2 7.7 7.6 9.3V16.7C9.2 18.3 11.2 18.3 13 17.5C14.8 18.3 16.8 18.3 18.4 16.7V9.3C16.8 7.7 14.8 7.7 13 8.5Z"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linejoin="round"
        />
        <line x1="13" y1="8.5" x2="13" y2="17.5" stroke="currentColor" stroke-width="1.3" />
      </svg>
    </span>
    <span class="brand-word">
      <span class="brand-initial">{{ word().initial }}</span><span>{{ word().rest }}</span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.34em;
      font-size: 1.6rem;
      line-height: 1;
      white-space: nowrap;
      user-select: none;
    }
    :host(.brand-hero) {
      font-size: 3.4rem;
    }
    .brand-mark {
      display: inline-flex;
      color: var(--color-accent);
    }
    .brand-mark svg {
      display: block;
      width: 0.92em;
      height: 0.92em;
    }
    .brand-word {
      font-family: var(--font-brand);
      font-weight: 600;
      color: var(--color-foreground);
      letter-spacing: 0.005em;
    }
    .brand-initial {
      font-weight: 700;
      color: var(--color-brand-rubric);
    }
  `,
  host: {
    '[class.brand-hero]': "size() === 'hero'",
  },
})
export class BrandComponent {
  private readonly locale = inject(LocaleService);

  readonly size = input<BrandSize>('header');

  protected readonly word = computed(() => {
    const name = LOCALE_META[this.locale.active()].brand;
    return { initial: name.charAt(0), rest: name.slice(1) };
  });
}
