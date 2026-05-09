import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ResolvedEntity } from '@shared/data-access';
import { EntityRefHoverService } from './entity-ref-hover.service';

@Component({
  selector: 'app-entity-ref-popover',
  template: `
    <div
      role="tooltip"
      class="pointer-events-auto max-w-xs rounded-md border border-border bg-surface p-3 text-sm shadow-lg"
      (mouseenter)="hover.cancelClose()"
      (mouseleave)="hover.scheduleClose()"
    >
      <p class="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-foreground-faint">
        {{ kindLabel() }}
      </p>
      @if (resolved(); as r) {
        <p class="m-0 mt-0.5 text-sm font-semibold text-foreground">{{ r.name }}</p>
        @if (r.description; as d) {
          <p class="m-0 mt-2 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-foreground-muted">
            {{ d }}
          </p>
        }
      } @else {
        <p class="m-0 mt-1 text-sm text-foreground-faint">Unresolved reference</p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityRefPopoverComponent {
  readonly resolved = input<ResolvedEntity | null>(null);
  readonly kindLabel = input<string>('');

  protected readonly hover = inject(EntityRefHoverService);
}
