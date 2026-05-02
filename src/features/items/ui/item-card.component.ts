import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CharactersService } from '@features/characters';
import { PlacesService } from '@features/places';
import { DangerButtonComponent, GhostButtonComponent } from '@shared/ui';
import { Item } from '../data-access/item.types';

@Component({
  selector: 'app-item-card',
  imports: [GhostButtonComponent, DangerButtonComponent],
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
      </div>

      @if (item().description; as d) {
        <p class="m-0 line-clamp-3 text-sm text-slate-700">{{ d }}</p>
      }

      <dl class="grid grid-cols-[max-content_1fr] gap-x-2 text-xs text-slate-600">
        @if (ownerName(); as n) {
          <dt class="font-medium text-slate-500">Owner</dt>
          <dd class="m-0">{{ n }}</dd>
        }
        @if (placeName(); as n) {
          <dt class="font-medium text-slate-500">Place</dt>
          <dd class="m-0">{{ n }}</dd>
        }
        @if (relatedNames().length > 0) {
          <dt class="font-medium text-slate-500">Related</dt>
          <dd class="m-0">{{ relatedNames().join(', ') }}</dd>
        }
      </dl>

      @if (canEdit()) {
        <div class="mt-auto flex gap-2 pt-2">
          <button uiGhost type="button" (click)="edit.emit()">Edit</button>
          <button uiDanger type="button" (click)="remove.emit()">Delete</button>
        </div>
      }
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemCardComponent {
  readonly item = input.required<Item>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);

  protected readonly ownerName = computed(() => {
    const ref = this.item().owner;
    if (!ref) return null;
    return this.characters.characters().find((c) => c.id === ref.id)?.name ?? null;
  });

  protected readonly placeName = computed(() => {
    const ref = this.item().place;
    if (!ref) return null;
    return this.places.places().find((p) => p.id === ref.id)?.name ?? null;
  });

  protected readonly relatedNames = computed(() => {
    const refs = this.item().relatedCharacters ?? [];
    if (refs.length === 0) return [];
    const lookup = new Map(this.characters.characters().map((c) => [c.id, c.name]));
    return refs.map((r) => lookup.get(r.id) ?? '?').filter(Boolean);
  });
}
