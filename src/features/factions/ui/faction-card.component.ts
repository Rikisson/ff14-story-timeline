import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  DangerButtonComponent,
  EntityRefComponent,
  GhostButtonComponent,
} from '@shared/ui';
import { Faction } from '../data-access/faction.types';

@Component({
  selector: 'app-faction-card',
  imports: [GhostButtonComponent, DangerButtonComponent, EntityRefComponent],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div class="flex items-start gap-2">
        <div class="flex flex-1 flex-col gap-0.5">
          <h3 class="m-0 text-lg font-semibold text-slate-900">{{ faction().name }}</h3>
          @if (faction().type; as t) {
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

      @if (faction().description; as d) {
        <p class="m-0 whitespace-pre-line text-sm text-slate-700">{{ d }}</p>
      }

      <dl class="grid grid-cols-[max-content_1fr] items-baseline gap-x-2 gap-y-1 text-xs text-slate-600">
        @if (faction().headquarters; as hq) {
          <dt class="font-medium text-slate-500">HQ</dt>
          <dd class="m-0"><app-entity-ref [ref]="hq" /></dd>
        }
        @if ((faction().relatedCharacters ?? []).length > 0) {
          <dt class="font-medium text-slate-500">Members</dt>
          <dd class="m-0 flex flex-wrap gap-1">
            @for (c of faction().relatedCharacters ?? []; track c.id) {
              <app-entity-ref [ref]="c" />
            }
          </dd>
        }
        @if ((faction().relatedPlaces ?? []).length > 0) {
          <dt class="font-medium text-slate-500">Places</dt>
          <dd class="m-0 flex flex-wrap gap-1">
            @for (p of faction().relatedPlaces ?? []; track p.id) {
              <app-entity-ref [ref]="p" />
            }
          </dd>
        }
      </dl>

    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FactionCardComponent {
  readonly faction = input.required<Faction>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();
}
