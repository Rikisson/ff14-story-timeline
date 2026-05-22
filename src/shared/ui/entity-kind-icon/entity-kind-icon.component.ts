import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EntityKind } from '@shared/models';

@Component({
  selector: 'app-entity-kind-icon',
  host: { class: 'inline-block' },
  template: `
    <svg
      viewBox="0 0 24 24"
      class="h-full w-full"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (kind()) {
        @case ('character') {
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        }
        @case ('place') {
          <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.5" />
        }
        @case ('event') {
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M4 10h16M9 3v4M15 3v4" />
        }
        @case ('story') {
          <path
            d="M12 7C10.4 5.7 8.3 5 6 5H3v13h3c2.3 0 4.4.7 6 2 1.6-1.3 3.7-2 6-2h3V5h-3c-2.3 0-4.4.7-6 2Z"
          />
          <path d="M12 7v13" />
        }
        @case ('plotline') {
          <path d="M6 21V4M6 4h11l-2.5 4L17 12H6" />
        }
        @case ('codexEntry') {
          <path d="M6 3h12v18l-6-4-6 4z" />
        }
      }
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityKindIconComponent {
  readonly kind = input.required<EntityKind>();
}
