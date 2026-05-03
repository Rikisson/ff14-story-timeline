import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { createEntityListController } from '@shared/data-access';
import { PrimaryButtonComponent } from '@shared/ui';
import { CodexEntriesService } from '../data-access/codex-entries.service';
import { CodexEntry, CodexEntryDraft } from '../data-access/codex-entry.types';
import { CodexEntryCardComponent } from '../ui/codex-entry-card.component';
import { CodexEntryFormComponent } from '../ui/codex-entry-form.component';

@Component({
  selector: 'app-codex-page',
  imports: [PrimaryButtonComponent, CodexEntryCardComponent, CodexEntryFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Codex</h1>
        @if (ctrl.canCreate() && ctrl.mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="ctrl.startCreate()">+ Add entry</button>
        }
      </div>

      @if (ctrl.mode().kind !== 'idle') {
        <app-codex-entry-form
          [initial]="ctrl.editingDraft()"
          [busy]="ctrl.busy()"
          [errorMessage]="ctrl.errorMessage()"
          (submitted)="ctrl.submit($event)"
          (cancelled)="ctrl.cancel()"
        />
      }

      @if (entries().length === 0) {
        <p class="text-slate-600">No codex entries yet.</p>
      } @else {
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] justify-start gap-4">
          @for (e of entries(); track e.id) {
            <li>
              <app-codex-entry-card
                [entry]="e"
                [canEdit]="ctrl.canCreate()"
                (edit)="ctrl.startEdit(e)"
                (remove)="ctrl.confirmRemove(e)"
              />
            </li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodexPage {
  private readonly service = inject(CodexEntriesService);
  protected readonly entries = this.service.entries;

  protected readonly ctrl = createEntityListController<CodexEntry, CodexEntryDraft>({
    entities: this.entries,
    service: this.service,
    toDraft: (e) => ({
      slug: e.slug,
      title: e.title,
      category: e.category,
      body: e.body,
      relatedRefs: e.relatedRefs,
    }),
    removeLabel: (e) => e.title,
  });
}
