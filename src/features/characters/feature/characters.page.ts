import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { authFeature } from '@features/auth';
import { Character, CharacterDraft, CharactersService } from '@features/characters';
import { PrimaryButtonComponent } from '@shared/ui';
import { CharacterCardComponent } from '../ui/character-card.component';
import { CharacterFormComponent } from '../ui/character-form.component';

type Mode = { kind: 'idle' } | { kind: 'create' } | { kind: 'edit'; id: string };

@Component({
  selector: 'app-characters-page',
  imports: [PrimaryButtonComponent, CharacterCardComponent, CharacterFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="m-0 text-2xl font-semibold text-slate-900">Characters</h2>
        @if (user() && mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="startCreate()">+ Add character</button>
        }
      </div>

      @if (mode().kind !== 'idle') {
        <app-character-form
          [initial]="editingDraft()"
          [busy]="busy()"
          [errorMessage]="errorMessage()"
          (submitted)="onSubmit($event)"
          (cancelled)="cancel()"
        />
      }

      @if (characters().length === 0) {
        <p class="text-slate-600">No characters yet.</p>
      } @else {
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] justify-start gap-4">
          @for (c of characters(); track c.id) {
            <li>
              <app-character-card
                [character]="c"
                [canEdit]="canEdit(c)"
                (edit)="startEdit(c)"
                (remove)="confirmRemove(c)"
              />
            </li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharactersPage {
  private readonly service = inject(CharactersService);
  protected readonly user = inject(Store).selectSignal(authFeature.selectUser);

  protected readonly characters = this.service.characters;
  protected readonly mode = signal<Mode>({ kind: 'idle' });
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly editingDraft = computed<CharacterDraft | null>(() => {
    const m = this.mode();
    if (m.kind !== 'edit') return null;
    const c = this.characters().find((x) => x.id === m.id);
    return c ? { name: c.name, race: c.race, job: c.job } : null;
  });

  protected canEdit(c: Character): boolean {
    const u = this.user();
    return !!u && u.uid === c.authorUid;
  }

  protected startCreate(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'create' });
  }

  protected startEdit(c: Character): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'edit', id: c.id });
  }

  protected cancel(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'idle' });
  }

  protected async onSubmit(draft: CharacterDraft): Promise<void> {
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

  protected async confirmRemove(c: Character): Promise<void> {
    if (!confirm(`Delete "${c.name}"? This can't be undone.`)) return;
    try {
      await this.service.remove(c.id);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    }
  }
}
