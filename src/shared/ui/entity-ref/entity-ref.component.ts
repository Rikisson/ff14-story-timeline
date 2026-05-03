import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, viewChild } from '@angular/core';
import { EntityResolverService } from '@shared/data-access';
import { EntityRef } from '@shared/models';
import { KIND_UI_CLASS } from '@shared/utils';
import { EntityRefHoverService } from './entity-ref-hover.service';

@Component({
  selector: 'app-entity-ref',
  template: `
    <button
      #anchor
      type="button"
      class="inline-flex max-w-full cursor-help items-center gap-1 truncate rounded-none px-2 py-0.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
      [class]="chipClass()"
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
  protected readonly chipClass = computed(() => KIND_UI_CLASS[this.ref().kind]);

  protected onShow(): void {
    this.hover.show(this.ref(), this.anchor().nativeElement);
  }

  protected onHide(): void {
    this.hover.scheduleClose();
  }
}
