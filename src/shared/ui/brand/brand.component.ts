import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LOCALE_META, LocaleService } from '@shared/services';

export type BrandSize = 'header' | 'hero';

@Component({
  selector: 'app-brand',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showMark()) {
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="13" cy="13" r="12" stroke="currentColor" stroke-width="1.5" />
          <g
            transform="translate(1 1)"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M12 7C10.4 5.7 8.3 5 6 5H3v13h3c2.3 0 4.4.7 6 2 1.6-1.3 3.7-2 6-2h3V5h-3c-2.3 0-4.4.7-6 2Z"
            />
            <path d="M12 7v13" />
          </g>
        </svg>
      </span>
    }
    @if (showWord()) {
      <span class="brand-word">
        <span class="brand-initial">{{ word().initial }}</span><span>{{ word().rest }}</span>
      </span>
    }
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
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: var(--font-display);
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
  readonly showMark = input(true);
  readonly showWord = input(true);
  readonly wordOverride = input<string | null>(null);

  protected readonly word = computed(() => {
    const name = this.wordOverride() ?? LOCALE_META[this.locale.active()].brand;
    return { initial: name.charAt(0), rest: name.slice(1) };
  });
}
