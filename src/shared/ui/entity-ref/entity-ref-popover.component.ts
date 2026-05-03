import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ResolvedEntity } from '@shared/data-access';
import { EntityRefHoverService } from './entity-ref-hover.service';

@Component({
  selector: 'app-entity-ref-popover',
  template: `
    <div
      role="tooltip"
      class="pointer-events-auto max-w-xs rounded-md border border-slate-200 bg-white p-3 text-sm shadow-lg"
      (mouseenter)="hover.cancelClose()"
      (mouseleave)="hover.scheduleClose()"
    >
      <p class="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        {{ kindLabel() }}
      </p>
      @if (resolved(); as r) {
        <p class="m-0 mt-0.5 text-sm font-semibold text-slate-900">{{ r.name }}</p>
        @if (description(); as d) {
          <p class="m-0 mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-700">
            {{ d }}
          </p>
        }
      } @else {
        <p class="m-0 mt-1 text-sm text-slate-500">Unresolved reference</p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityRefPopoverComponent {
  readonly resolved = input<ResolvedEntity | null>(null);
  readonly kindLabel = input<string>('');

  protected readonly hover = inject(EntityRefHoverService);

  protected description(): string | undefined {
    const r = this.resolved();
    if (!r) return undefined;
    return r.shortDescription ?? r.description;
  }
}
