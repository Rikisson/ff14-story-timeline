import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CharactersService } from '@features/characters';
import { PlacesService } from '@features/places';
import { DangerButtonComponent, GhostButtonComponent } from '@shared/ui';
import { TimelineEvent } from '../data-access/event.types';

@Component({
  selector: 'app-event-card',
  imports: [GhostButtonComponent, DangerButtonComponent],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/40 p-4 shadow-sm"
    >
      <div class="flex items-start justify-between gap-2">
        <h3 class="m-0 text-lg font-semibold text-slate-900">{{ event().name }}</h3>
        <span
          class="rounded bg-amber-500 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white"
          aria-label="Event entry"
        >
          Event
        </span>
      </div>

      @if (event().inGameDate; as d) {
        <p class="m-0 text-xs font-medium uppercase tracking-wide text-amber-700">{{ d }}</p>
      }

      @if (event().description; as desc) {
        <p class="m-0 line-clamp-4 whitespace-pre-line text-sm text-slate-700">{{ desc }}</p>
      }

      @if (
        characterNames().length || placeNames().length || event().relatedDates.length
      ) {
        <div class="flex flex-wrap gap-1.5">
          @for (c of characterNames(); track $index) {
            <span class="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{{ c }}</span>
          }
          @for (p of placeNames(); track $index) {
            <span class="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">{{ p }}</span>
          }
          @for (d of event().relatedDates; track d) {
            <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{{ d }}</span>
          }
        </div>
      }

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
export class EventCardComponent {
  readonly event = input.required<TimelineEvent>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);

  protected readonly characterNames = computed(() => {
    const refs = this.event().mainCharacters;
    if (refs.length === 0) return [];
    const lookup = new Map(this.characters.characters().map((c) => [c.id, c.name]));
    return refs.map((r) => lookup.get(r.id) ?? '?');
  });

  protected readonly placeNames = computed(() => {
    const refs = this.event().places;
    if (refs.length === 0) return [];
    const lookup = new Map(this.places.places().map((p) => [p.id, p.name]));
    return refs.map((r) => lookup.get(r.id) ?? '?');
  });
}
