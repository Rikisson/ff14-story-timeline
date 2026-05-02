import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';
import { PrimaryButtonComponent } from '@shared/ui';
import { CodexEntriesService } from '../data-access/codex-entries.service';
import { CodexEntry, CodexEntryDraft } from '../data-access/codex-entry.types';
import { CodexEntryCardComponent } from '../ui/codex-entry-card.component';
import { CodexEntryFormComponent } from '../ui/codex-entry-form.component';

type Mode = { kind: 'idle' } | { kind: 'create' } | { kind: 'edit'; id: string };

@Component({
  selector: 'app-codex-page',
  imports: [PrimaryButtonComponent, CodexEntryCardComponent, CodexEntryFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Codex</h1>
        @if (canCreate() && mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="startCreate()">+ Add entry</button>
        }
      </div>

      @if (mode().kind !== 'idle') {
        <app-codex-entry-form
          [initial]="editingDraft()"
          [busy]="busy()"
          [errorMessage]="errorMessage()"
          (submitted)="onSubmit($event)"
          (cancelled)="cancel()"
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
                [canEdit]="canEdit(e)"
                (edit)="startEdit(e)"
                (remove)="confirmRemove(e)"
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
  private readonly universes = inject(UniverseStore);
  protected readonly user = inject(AuthStore).user;

  protected readonly entries = this.service.entries;
  protected readonly mode = signal<Mode>({ kind: 'idle' });
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly canCreate = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly editingDraft = computed<CodexEntryDraft | null>(() => {
    const m = this.mode();
    if (m.kind !== 'edit') return null;
    const e = this.entries().find((x) => x.id === m.id);
    return e
      ? {
          slug: e.slug,
          title: e.title,
          category: e.category,
          body: e.body,
          relatedRefs: e.relatedRefs,
        }
      : null;
  });

  protected canEdit(e: CodexEntry): boolean {
    const u = this.user();
    return !!u && u.uid === e.authorUid;
  }

  protected startCreate(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'create' });
  }

  protected startEdit(e: CodexEntry): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'edit', id: e.id });
  }

  protected cancel(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'idle' });
  }

  protected async onSubmit(draft: CodexEntryDraft): Promise<void> {
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

  protected async confirmRemove(e: CodexEntry): Promise<void> {
    if (!confirm(`Delete "${e.title}"? This can't be undone.`)) return;
    try {
      await this.service.remove(e.id);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    }
  }
}
