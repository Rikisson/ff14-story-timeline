import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ResolvedEntity } from '@shared/data-access';
import { EntityRefHoverService } from './entity-ref-hover.service';

@Component({
  selector: 'app-entity-ref-popover',
  template: `
    <div
      role="tooltip"
      class="pointer-events-auto max-w-xs rounded-md border border-slate-200 bg-white p-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900"
      (mouseenter)="hover.cancelClose()"
      (mouseleave)="hover.scheduleClose()"
    >
      <p class="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {{ kindLabel() }}
      </p>
      @if (resolved(); as r) {
        <p class="m-0 mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ r.name }}</p>
        @if (r.description; as d) {
          <p class="m-0 mt-2 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {{ d }}
          </p>
        }
      } @else {
        <p class="m-0 mt-1 text-sm text-slate-500 dark:text-slate-400">Unresolved reference</p>
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
