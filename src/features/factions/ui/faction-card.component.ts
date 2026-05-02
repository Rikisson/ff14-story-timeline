import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CharactersService } from '@features/characters';
import { PlacesService } from '@features/places';
import { DangerButtonComponent, GhostButtonComponent } from '@shared/ui';
import { Faction } from '../data-access/faction.types';

@Component({
  selector: 'app-faction-card',
  imports: [GhostButtonComponent, DangerButtonComponent],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div class="flex flex-col gap-0.5">
        <h3 class="m-0 text-lg font-semibold text-slate-900">{{ faction().name }}</h3>
        @if (faction().type; as t) {
          <span class="text-xs uppercase tracking-wide text-slate-500">{{ t }}</span>
        }
      </div>

      @if (faction().description; as d) {
        <p class="m-0 line-clamp-3 text-sm text-slate-700">{{ d }}</p>
      }

      <dl class="grid grid-cols-[max-content_1fr] gap-x-2 text-xs text-slate-600">
        @if (hqName(); as n) {
          <dt class="font-medium text-slate-500">HQ</dt>
          <dd class="m-0">{{ n }}</dd>
        }
        @if (memberNames().length > 0) {
          <dt class="font-medium text-slate-500">Members</dt>
          <dd class="m-0">{{ memberNames().join(', ') }}</dd>
        }
        @if (placeNames().length > 0) {
          <dt class="font-medium text-slate-500">Places</dt>
          <dd class="m-0">{{ placeNames().join(', ') }}</dd>
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
export class FactionCardComponent {
  readonly faction = input.required<Faction>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);

  protected readonly hqName = computed(() => {
    const ref = this.faction().headquarters;
    if (!ref) return null;
    return this.places.places().find((p) => p.id === ref.id)?.name ?? null;
  });

  protected readonly memberNames = computed(() => {
    const refs = this.faction().relatedCharacters ?? [];
    if (refs.length === 0) return [];
    const lookup = new Map(this.characters.characters().map((c) => [c.id, c.name]));
    return refs.map((r) => lookup.get(r.id) ?? '?');
  });

  protected readonly placeNames = computed(() => {
    const refs = this.faction().relatedPlaces ?? [];
    if (refs.length === 0) return [];
    const lookup = new Map(this.places.places().map((p) => [p.id, p.name]));
    return refs.map((r) => lookup.get(r.id) ?? '?');
  });
}
