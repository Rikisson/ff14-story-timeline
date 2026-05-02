import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';
import { PrimaryButtonComponent } from '@shared/ui';
import { PlotlinesService } from '../data-access/plotlines.service';
import { Plotline, PlotlineDraft } from '../data-access/plotline.types';
import { PlotlineCardComponent } from '../ui/plotline-card.component';
import { PlotlineFormComponent } from '../ui/plotline-form.component';

type Mode = { kind: 'idle' } | { kind: 'create' } | { kind: 'edit'; id: string };

@Component({
  selector: 'app-plotlines-page',
  imports: [PrimaryButtonComponent, PlotlineCardComponent, PlotlineFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Plotlines</h1>
        @if (canCreate() && mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="startCreate()">+ Add plotline</button>
        }
      </div>

      @if (mode().kind !== 'idle') {
        <app-plotline-form
          [initial]="editingDraft()"
          [busy]="busy()"
          [errorMessage]="errorMessage()"
          (submitted)="onSubmit($event)"
          (cancelled)="cancel()"
        />
      }

      @if (plotlines().length === 0) {
        <p class="text-slate-600">No plotlines yet.</p>
      } @else {
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] justify-start gap-4">
          @for (p of plotlines(); track p.id) {
            <li>
              <app-plotline-card
                [plotline]="p"
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
export class PlotlinesPage {
  private readonly service = inject(PlotlinesService);
  private readonly universes = inject(UniverseStore);
  protected readonly user = inject(AuthStore).user;

  protected readonly plotlines = this.service.plotlines;
  protected readonly mode = signal<Mode>({ kind: 'idle' });
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly canCreate = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly editingDraft = computed<PlotlineDraft | null>(() => {
    const m = this.mode();
    if (m.kind !== 'edit') return null;
    const p = this.plotlines().find((x) => x.id === m.id);
    return p
      ? {
          slug: p.slug,
          title: p.title,
          summary: p.summary,
          color: p.color,
          status: p.status,
        }
      : null;
  });

  protected canEdit(p: Plotline): boolean {
    const u = this.user();
    return !!u && u.uid === p.authorUid;
  }

  protected startCreate(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'create' });
  }

  protected startEdit(p: Plotline): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'edit', id: p.id });
  }

  protected cancel(): void {
    this.errorMessage.set(null);
    this.mode.set({ kind: 'idle' });
  }

  protected async onSubmit(draft: PlotlineDraft): Promise<void> {
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

  protected async confirmRemove(p: Plotline): Promise<void> {
    if (!confirm(`Delete "${p.title}"? This can't be undone.`)) return;
    try {
      await this.service.remove(p.id);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    }
  }
}
