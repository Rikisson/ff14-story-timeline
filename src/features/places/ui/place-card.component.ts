import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Place } from '../data-access/place.types';
import { DangerButtonComponent, GhostButtonComponent } from '@shared/ui';

@Component({
  selector: 'app-place-card',
  imports: [GhostButtonComponent, DangerButtonComponent],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h3 class="m-0 text-lg font-semibold text-slate-900">{{ place().name }}</h3>
      <p class="m-0 text-sm text-slate-700">
        <span class="font-medium text-slate-500">Position:</span>
        {{ place().geoPosition }}
      </p>
      @if (place().factions.length > 0) {
        <div class="flex flex-wrap gap-1.5">
          @for (f of place().factions; track f) {
            <span class="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">{{ f }}</span>
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
export class PlaceCardComponent {
  readonly place = input.required<Place>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();
}
