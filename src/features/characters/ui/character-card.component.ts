import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Character } from '../data-access/character.types';
import { DangerButtonComponent, GhostButtonComponent } from '@shared/ui';

@Component({
  selector: 'app-character-card',
  imports: [GhostButtonComponent, DangerButtonComponent],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div class="flex items-start justify-between gap-2">
        <h3 class="m-0 flex-1 text-lg font-semibold text-slate-900">{{ character().name }}</h3>
        @if (canEdit()) {
          <div class="flex shrink-0 gap-1">
            <button uiGhost type="button" (click)="edit.emit()">Edit</button>
            <button uiDanger type="button" (click)="remove.emit()">Delete</button>
          </div>
        }
      </div>
      <dl class="m-0 flex flex-col gap-1 text-sm text-slate-700">
        <div class="flex gap-2">
          <dt class="w-12 font-medium text-slate-500">Race</dt>
          <dd class="m-0">{{ character().race }}</dd>
        </div>
        <div class="flex gap-2">
          <dt class="w-12 font-medium text-slate-500">Job</dt>
          <dd class="m-0">{{ character().job }}</dd>
        </div>
      </dl>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterCardComponent {
  readonly character = input.required<Character>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();
}
