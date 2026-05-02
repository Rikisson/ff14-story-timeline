import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';
import { PrimaryButtonComponent } from '@shared/ui';
import { ItemsService } from '../data-access/items.service';
import { Item, ItemDraft } from '../data-access/item.types';
import { ItemCardComponent } from '../ui/item-card.component';
import { ItemFormComponent } from '../ui/item-form.component';

type Mode = { kind: 'idle' } | { kind: 'create' } | { kind: 'edit'; id: string };

@Component({
  selector: 'app-items-page',
  imports: [PrimaryButtonComponent, ItemCardComponent, ItemFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Items</h1>
        @if (canCreate() && mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="startCreate()">+ Add item</button>
        }
      </div>

      @if (mode().kind !== 'idle') {
        <app-item-form
          [initial]="editingDraft()"
          [busy]="busy()"
          [errorMessage]="errorMessage()"
          (submitted)="onSubmit($event)"
          (cancelled)="cancel()"
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
                [canEdit]="canEdit(i)"
                (edit)="startEdit(i)"
                (remove)="confirmRemove(i)"
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
  private readonly universes = inject(UniverseStore);
  protected readonly user = inject(AuthStore).user;

  protected readonly items = this.service.items;
  protected readonly mode = signal<Mode>({ kind: 'idle' });
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly canCreate = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly editingDraft = computed<ItemDraft | null>(() => {
    const m = this.mode();
    if (m.kind !== 'edit') return null;
    const i = this.items().find((x) => x.id === m.id);
    return i
      ? {
          slug: i.slug,
          name: i.name,
          type: i.type,
          description: i.description,
          image: i.image,
          owner: i.owner,
          place: i.place,
          relatedCharacters: i.relatedCharacters,
        }
      : null;
  });

  protected canEdit(i: Item): boolean {
    const u = this.user();
    return !!u && u.uid === i.authorUid;
  }

  protected startCreate(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'create' });
  }

  protected startEdit(i: Item): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'edit', id: i.id });
  }

  protected cancel(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'idle' });
  }

  protected async onSubmit(draft: ItemDraft): Promise<void> {
    const u = this.user();
    if (!u) return;
    const m = this.mode();
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      if (m.kind === 'create') await this.service.create(draft, u.uid);
      else if (m.kind === 'edit') await this.service.update(m.id, draft);
      this.mode.set({ kind: 'idle' });
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.busy.set(false);
    }
  }

  protected async confirmRemove(i: Item): Promise<void> {
    if (!confirm(`Delete "${i.name}"? This can't be undone.`)) return;
    try {
      await this.service.remove(i.id);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    }
  }
}
