import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, viewChild } from '@angular/core';
import { EntityResolverService } from '@shared/data-access';
import { EntityRef } from '@shared/models';
import { EntityRefHoverService } from './entity-ref-hover.service';

const KIND_CHIP: Record<string, string> = {
  character: 'bg-indigo-50 text-indigo-700',
  place: 'bg-emerald-50 text-emerald-700',
  event: 'bg-amber-50 text-amber-800',
  story: 'bg-fuchsia-50 text-fuchsia-700',
  plotline: 'bg-sky-50 text-sky-700',
  item: 'bg-orange-50 text-orange-800',
  faction: 'bg-rose-50 text-rose-700',
  codexEntry: 'bg-slate-100 text-slate-700',
};

@Component({
  selector: 'app-entity-ref',
  template: `
    <button
      #anchor
      type="button"
      class="inline-flex max-w-full items-center gap-1 truncate rounded px-2 py-0.5 text-xs font-medium underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      [class]="chipClass()"
      [attr.aria-describedby]="'entity-ref-' + ref().id"
      (mouseenter)="onShow()"
      (mouseleave)="onHide()"
      (focus)="onShow()"
      (blur)="onHide()"
    >
      {{ display() }}
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityRefComponent {
  readonly ref = input.required<EntityRef>();
  readonly label = input<string | null>(null);

  private readonly resolver = inject(EntityResolverService);
  private readonly hover = inject(EntityRefHoverService);
  private readonly anchor = viewChild.required<ElementRef<HTMLElement>>('anchor');

  protected readonly resolved = computed(() => this.resolver.resolve(this.ref()));
  protected readonly display = computed(() => this.label() ?? this.resolved()?.name ?? '?');
  protected readonly chipClass = computed(() => KIND_CHIP[this.ref().kind] ?? KIND_CHIP['codexEntry']);

  protected onShow(): void {
    this.hover.show(this.ref(), this.anchor().nativeElement);
  }

  protected onHide(): void {
    this.hover.scheduleClose();
  }
}
