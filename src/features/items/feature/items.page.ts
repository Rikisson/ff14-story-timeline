import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { createEntityListController } from '@shared/data-access';
import { EntityListPaneComponent, ListPaneItem, PageHeaderComponent } from '@shared/ui';
import { ItemsService } from '../data-access/items.service';
import { Item, ItemDraft } from '../data-access/item.types';
import { ItemCardComponent } from '../ui/item-card.component';
import { ItemFormComponent } from '../ui/item-form.component';

@Component({
  selector: 'app-items-page',
  host: { class: 'block h-full' },
  imports: [EntityListPaneComponent, ItemCardComponent, ItemFormComponent, PageHeaderComponent],
  template: `
    <div class="flex h-full flex-col gap-4">
      <app-page-header
        title="Items"
        subtitle="Objects and artifacts referenced throughout this universe."
      />

      <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        <app-entity-list-pane
          class="md:w-80 md:shrink-0"
          [items]="listItems()"
          [selectedId]="ctrl.selectedId()"
          [hasMore]="service.hasMore()"
          [loadingMore]="service.loadingMore()"
          [canCreate]="ctrl.canCreate()"
          createLabel="+ Add item"
          emptyMessage="No items yet."
          ariaLabel="Items list"
          (select)="onSelect($event)"
          (create)="ctrl.startCreate()"
          (loadMore)="service.loadMore()"
        />

        <section class="flex min-h-0 flex-col md:flex-1" aria-label="Item details">
          @if (ctrl.mode().kind === 'create' || ctrl.mode().kind === 'edit') {
            <div class="min-h-0 flex-1 overflow-y-auto">
              <app-item-form
                [initial]="ctrl.editingDraft()"
                [busy]="ctrl.busy()"
                [errorMessage]="ctrl.errorMessage()"
                (submitted)="ctrl.submit($event)"
                (cancelled)="ctrl.cancel()"
              />
            </div>
          } @else if (ctrl.selected(); as i) {
            <div class="min-h-0 flex-1 overflow-y-auto">
              <app-item-card
                [item]="i"
                [canEdit]="ctrl.canCreate()"
                (edit)="ctrl.startEdit(i)"
                (remove)="ctrl.confirmRemove(i)"
              />
            </div>
          } @else {
            <p class="m-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              Select an item to view details.
            </p>
          }
        </section>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemsPage {
  protected readonly service = inject(ItemsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly items = this.service.items;
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });

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

  protected readonly listItems = computed<ListPaneItem[]>(() =>
    this.items().map((i) => ({
      id: i.id,
      label: i.name,
      secondary: i.type,
    })),
  );

  constructor() {
    effect(() => {
      const id = this.routeId().get('id');
      this.ctrl.select(id ?? null);
    });

    effect(() => {
      const id = this.ctrl.selectedId();
      const current = this.routeId().get('id') ?? null;
      if (id !== current) {
        void this.router.navigate(id ? ['/items', id] : ['/items'], {
          replaceUrl: true,
        });
      }
    });
  }

  protected onSelect(id: string): void {
    void this.router.navigate(['/items', id]);
  }
}
