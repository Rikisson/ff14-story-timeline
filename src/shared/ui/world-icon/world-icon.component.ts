import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-world-icon',
  host: { class: 'inline-block' },
  template: `
    <svg
      viewBox="0 0 24 24"
      class="h-full w-full"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorldIconComponent {}
