import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  DangerButtonComponent,
  EntityRefComponent,
  GhostButtonComponent,
  TagComponent,
} from '@shared/ui';
import { CodexEntry } from '../data-access/codex-entry.types';

@Component({
  selector: 'app-codex-entry-card',
  imports: [GhostButtonComponent, DangerButtonComponent, EntityRefComponent, TagComponent],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div class="flex items-start justify-between gap-2">
        <h3 class="m-0 flex-1 text-lg font-semibold text-slate-900">{{ entry().title }}</h3>
        <div class="flex shrink-0 items-center gap-2">
          @if (entry().category; as c) {
            <app-tag>{{ c }}</app-tag>
          }
          @if (canEdit()) {
            <button uiGhost type="button" (click)="edit.emit()">Edit</button>
            <button uiDanger type="button" (click)="remove.emit()">Delete</button>
          }
        </div>
      </div>

      <p class="m-0 whitespace-pre-line text-sm text-slate-700">
        {{ entry().body }}
      </p>

      @if ((entry().relatedRefs ?? []).length > 0) {
        <ul class="flex flex-wrap gap-1.5">
          @for (r of entry().relatedRefs ?? []; track r.kind + ':' + r.id) {
            <li>
              <app-entity-ref [ref]="r" />
            </li>
          }
        </ul>
      }

    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodexEntryCardComponent {
  readonly entry = input.required<CodexEntry>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();
}
