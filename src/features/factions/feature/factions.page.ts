import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';
import { PrimaryButtonComponent } from '@shared/ui';
import { FactionsService } from '../data-access/factions.service';
import { Faction, FactionDraft } from '../data-access/faction.types';
import { FactionCardComponent } from '../ui/faction-card.component';
import { FactionFormComponent } from '../ui/faction-form.component';

type Mode = { kind: 'idle' } | { kind: 'create' } | { kind: 'edit'; id: string };

@Component({
  selector: 'app-factions-page',
  imports: [PrimaryButtonComponent, FactionCardComponent, FactionFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Factions</h1>
        @if (canCreate() && mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="startCreate()">+ Add faction</button>
        }
      </div>

      @if (mode().kind !== 'idle') {
        <app-faction-form
          [initial]="editingDraft()"
          [busy]="busy()"
          [errorMessage]="errorMessage()"
          (submitted)="onSubmit($event)"
          (cancelled)="cancel()"
        />
      }

      @if (factions().length === 0) {
        <p class="text-slate-600">No factions yet.</p>
      } @else {
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] justify-start gap-4">
          @for (f of factions(); track f.id) {
            <li>
              <app-faction-card
                [faction]="f"
                [canEdit]="canEdit(f)"
                (edit)="startEdit(f)"
                (remove)="confirmRemove(f)"
              />
            </li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FactionsPage {
  private readonly service = inject(FactionsService);
  private readonly universes = inject(UniverseStore);
  protected readonly user = inject(AuthStore).user;

  protected readonly factions = this.service.factions;
  protected readonly mode = signal<Mode>({ kind: 'idle' });
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly canCreate = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly editingDraft = computed<FactionDraft | null>(() => {
    const m = this.mode();
    if (m.kind !== 'edit') return null;
    const f = this.factions().find((x) => x.id === m.id);
    return f
      ? {
          slug: f.slug,
          name: f.name,
          type: f.type,
          description: f.description,
          headquarters: f.headquarters,
          relatedCharacters: f.relatedCharacters,
          relatedPlaces: f.relatedPlaces,
        }
      : null;
  });

  protected canEdit(_f: Faction): boolean {
    return this.canCreate();
  }

  protected startCreate(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'create' });
  }

  protected startEdit(f: Faction): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'edit', id: f.id });
  }

  protected cancel(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'idle' });
  }

  protected async onSubmit(draft: FactionDraft): Promise<void> {
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

  protected async confirmRemove(f: Faction): Promise<void> {
    if (!confirm(`Delete "${f.name}"? This can't be undone.`)) return;
    try {
      await this.service.remove(f.id);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    }
  }
}
