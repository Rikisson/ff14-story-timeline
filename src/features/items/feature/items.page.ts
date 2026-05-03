import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { createEntityListController } from '@shared/data-access';
import { PrimaryButtonComponent } from '@shared/ui';
import { ItemsService } from '../data-access/items.service';
import { Item, ItemDraft } from '../data-access/item.types';
import { ItemCardComponent } from '../ui/item-card.component';
import { ItemFormComponent } from '../ui/item-form.component';

@Component({
  selector: 'app-items-page',
  imports: [PrimaryButtonComponent, ItemCardComponent, ItemFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Items</h1>
        @if (ctrl.canCreate() && ctrl.mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="ctrl.startCreate()">+ Add item</button>
        }
      </div>

      @if (ctrl.mode().kind !== 'idle') {
        <app-item-form
          [initial]="ctrl.editingDraft()"
          [busy]="ctrl.busy()"
          [errorMessage]="ctrl.errorMessage()"
          (submitted)="ctrl.submit($event)"
          (cancelled)="ctrl.cancel()"
        />
      }

      @if (items().length === 0) {
        <p class="text-slate-600">No items yet.</p>
      } @else {
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] justify-start gap-4">
          @for (i of items(); track i.id) {
            <li>
              <app-item-card
                [item]="i"
                [canEdit]="ctrl.canCreate()"
                (edit)="ctrl.startEdit(i)"
                (remove)="ctrl.confirmRemove(i)"
              />
            </li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemsPage {
  private readonly service = inject(ItemsService);
  protected readonly items = this.service.items;

  protected readonly ctrl = createEntityListController<Item, ItemDraft>({
    entities: this.items,
    service: this.service,
    toDraft: (i) => ({
      slug: i.slug,
      name: i.name,
      type: i.type,
      description: i.description,
      image: i.image,
      owner: i.owner,
      place: i.place,
      relatedCharacters: i.relatedCharacters,
    }),
    removeLabel: (i) => i.name,
  });
}
