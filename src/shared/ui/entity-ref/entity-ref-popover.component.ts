import { ChangeDetectionStrategy, Component, computed, inject, input, Signal } from '@angular/core';
import {
  ResolvedCanonicalEntity,
  ResolvedDirectoryRow,
} from '@shared/data-access';
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
      @if (name(); as n) {
        <p class="m-0 mt-0.5 text-sm font-semibold text-foreground">{{ n }}</p>
        @if (description(); as d) {
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
  /** Live directory row — `label` resolves immediately from the cache. */
  readonly directory = input<Signal<ResolvedDirectoryRow | null> | null>(null);
  /** Canonical doc — `description` lands on first fetch (lazy). */
  readonly canonical = input<Signal<ResolvedCanonicalEntity | null> | null>(null);
  readonly kindLabel = input<string>('');

  protected readonly hover = inject(EntityRefHoverService);

  protected readonly name = computed(() => {
    const dir = this.directory()?.();
    if (dir?.label) return dir.label;
    return this.canonical()?.()?.name ?? null;
  });

  protected readonly description = computed(() => this.canonical()?.()?.description);
}
