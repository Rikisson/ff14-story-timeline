import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthStore } from '@features/auth';
import { Place, PlaceDraft, PlacesService } from '@features/places';
import { PrimaryButtonComponent } from '@shared/ui';
import { PlaceCardComponent } from '../ui/place-card.component';
import { PlaceFormComponent } from '../ui/place-form.component';

type Mode = { kind: 'idle' } | { kind: 'create' } | { kind: 'edit'; id: string };

@Component({
  selector: 'app-places-page',
  imports: [PrimaryButtonComponent, PlaceCardComponent, PlaceFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Places</h1>
        @if (user() && mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="startCreate()">+ Add place</button>
        }
      </div>

      @if (mode().kind !== 'idle') {
        <app-place-form
          [initial]="editingDraft()"
          [busy]="busy()"
          [errorMessage]="errorMessage()"
          (submitted)="onSubmit($event)"
          (cancelled)="cancel()"
        />
      }

      @if (places().length === 0) {
        <p class="text-slate-600">No places yet.</p>
      } @else {
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] justify-start gap-4">
          @for (p of places(); track p.id) {
            <li>
              <app-place-card
                [place]="p"
                [canEdit]="canEdit(p)"
                (edit)="startEdit(p)"
                (remove)="confirmRemove(p)"
              />
            </li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlacesPage {
  private readonly service = inject(PlacesService);
  protected readonly user = inject(AuthStore).user;

  protected readonly places = this.service.places;
  protected readonly mode = signal<Mode>({ kind: 'idle' });
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly editingDraft = computed<PlaceDraft | null>(() => {
    const m = this.mode();
    if (m.kind !== 'edit') return null;
    const p = this.places().find((x) => x.id === m.id);
    return p ? { name: p.name, geoPosition: p.geoPosition, factions: p.factions } : null;
  });

  protected canEdit(p: Place): boolean {
    const u = this.user();
    return !!u && u.uid === p.authorUid;
  }

  protected startCreate(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'create' });
  }

  protected startEdit(p: Place): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'edit', id: p.id });
  }

  protected cancel(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'idle' });
  }

  protected async onSubmit(draft: PlaceDraft): Promise<void> {
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

  protected async confirmRemove(p: Place): Promise<void> {
    if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    try {
      await this.service.remove(p.id);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    }
  }
}
