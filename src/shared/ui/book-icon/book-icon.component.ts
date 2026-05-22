import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-book-icon',
  host: { class: 'inline-block' },
  template: `
    <svg
      viewBox="6 6 14 14"
      class="h-full w-full"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path
        d="M13 8.5C11.2 7.7 9.2 7.7 7.6 9.3V16.7C9.2 18.3 11.2 18.3 13 17.5C14.8 18.3 16.8 18.3 18.4 16.7V9.3C16.8 7.7 14.8 7.7 13 8.5Z"
      />
      <line x1="13" y1="8.5" x2="13" y2="17.5" />
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookIconComponent {}
