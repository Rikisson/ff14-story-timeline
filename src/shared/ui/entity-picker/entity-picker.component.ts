import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { EntityKind, EntityRef } from '@shared/models';

export interface EntityPickerOption {
  id: string;
  label: string;
  slug?: string;
}

@Component({
  selector: 'app-entity-picker',
  template: `
    @if (options().length === 0) {
      <p class="m-0 text-sm italic text-slate-500">{{ emptyMessage() }}</p>
    } @else {
      <select
        [multiple]="multiple()"
        [attr.size]="multiple() ? sizeAttr() : null"
        class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        (change)="onChange($event)"
      >
        @if (!multiple()) {
          <option value="" [selected]="value().length === 0">— None —</option>
        }
        @for (opt of options(); track opt.id) {
          <option [value]="opt.id" [selected]="isSelected(opt.id)">
            {{ opt.label }}@if (opt.slug; as s) { · {{ s }} }
          </option>
        }
      </select>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityPickerComponent {
  readonly kind = input.required<EntityKind>();
  readonly options = input.required<EntityPickerOption[]>();
  readonly value = input<EntityRef[]>([]);
  readonly multiple = input<boolean>(true);
  readonly emptyMessage = input<string>('No options available in this universe.');
  readonly selected = output<EntityRef[]>();

  private readonly selectedIds = computed(() => new Set(this.value().map((r) => r.id)));

  protected isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  protected sizeAttr(): number {
    return Math.min(Math.max(this.options().length, 3), 8);
  }

  protected onChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const k = this.kind();
    const refs: EntityRef[] = Array.from(select.selectedOptions)
      .map((o) => o.value)
      .filter(Boolean)
      .map((id) => ({ kind: k, id }));
    this.selected.emit(refs);
  }
}
