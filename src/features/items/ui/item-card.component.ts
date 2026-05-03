import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  DangerButtonComponent,
  EntityRefComponent,
  GhostButtonComponent,
} from '@shared/ui';
import { Item } from '../data-access/item.types';

@Component({
  selector: 'app-item-card',
  imports: [GhostButtonComponent, DangerButtonComponent, EntityRefComponent],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div class="flex items-start gap-3">
        @if (item().image; as src) {
          <img
            [src]="src"
            alt=""
            class="size-12 shrink-0 rounded border border-slate-200 object-cover"
          />
        }
        <div class="flex flex-1 flex-col gap-0.5">
          <h3 class="m-0 text-lg font-semibold text-slate-900">{{ item().name }}</h3>
          @if (item().type; as t) {
            <span class="text-xs uppercase tracking-wide text-slate-500">{{ t }}</span>
          }
        </div>
        @if (canEdit()) {
          <div class="flex shrink-0 gap-1">
            <button uiGhost type="button" (click)="edit.emit()">Edit</button>
            <button uiDanger type="button" (click)="remove.emit()">Delete</button>
          </div>
        }
      </div>

      @if (item().description; as d) {
        <p class="m-0 whitespace-pre-line text-sm text-slate-700">{{ d }}</p>
      }

      <dl class="grid grid-cols-[max-content_1fr] items-baseline gap-x-2 gap-y-1 text-xs text-slate-600">
        @if (item().owner; as o) {
          <dt class="font-medium text-slate-500">Owner</dt>
          <dd class="m-0"><app-entity-ref [ref]="o" /></dd>
        }
        @if (item().place; as p) {
          <dt class="font-medium text-slate-500">Place</dt>
          <dd class="m-0"><app-entity-ref [ref]="p" /></dd>
        }
        @if ((item().relatedCharacters ?? []).length > 0) {
          <dt class="font-medium text-slate-500">Related</dt>
          <dd class="m-0 flex flex-wrap gap-1">
            @for (c of item().relatedCharacters ?? []; track c.id) {
              <app-entity-ref [ref]="c" />
            }
          </dd>
        }
      </dl>

    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemCardComponent {
  readonly item = input.required<Item>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();
}
