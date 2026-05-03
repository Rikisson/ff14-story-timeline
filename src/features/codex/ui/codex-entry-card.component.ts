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
        <h3 class="m-0 text-lg font-semibold text-slate-900">{{ entry().title }}</h3>
        @if (entry().category; as c) {
          <app-tag>{{ c }}</app-tag>
        }
      </div>

      <p class="m-0 line-clamp-4 whitespace-pre-line text-sm text-slate-700">
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
export class CodexEntryCardComponent {
  readonly entry = input.required<CodexEntry>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();
}
