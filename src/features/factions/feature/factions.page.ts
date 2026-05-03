import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { createEntityListController } from '@shared/data-access';
import { EntityListPaneComponent, ListPaneItem, PageHeaderComponent } from '@shared/ui';
import { FactionsService } from '../data-access/factions.service';
import { Faction, FactionDraft } from '../data-access/faction.types';
import { FactionCardComponent } from '../ui/faction-card.component';
import { FactionFormComponent } from '../ui/faction-form.component';

@Component({
  selector: 'app-factions-page',
  imports: [EntityListPaneComponent, FactionCardComponent, FactionFormComponent, PageHeaderComponent],
  template: `
    <div class="flex flex-col gap-4">
      <app-page-header
        title="Factions"
        subtitle="Organizations, houses, and powers acting across this universe."
      />

      <div class="grid gap-4 md:grid-cols-[320px_1fr]">
        <app-entity-list-pane
          [items]="listItems()"
          [selectedId]="ctrl.selectedId()"
          [hasMore]="service.hasMore()"
          [loadingMore]="service.loadingMore()"
          [canCreate]="ctrl.canCreate()"
          createLabel="+ Add faction"
          emptyMessage="No factions yet."
          ariaLabel="Factions list"
          (select)="onSelect($event)"
          (create)="ctrl.startCreate()"
          (loadMore)="service.loadMore()"
        />

        <section class="flex flex-col gap-3" aria-label="Faction details">
          @if (ctrl.mode().kind === 'create' || ctrl.mode().kind === 'edit') {
            <app-faction-form
              [initial]="ctrl.editingDraft()"
              [busy]="ctrl.busy()"
              [errorMessage]="ctrl.errorMessage()"
              (submitted)="ctrl.submit($event)"
              (cancelled)="ctrl.cancel()"
            />
          } @else if (ctrl.selected(); as f) {
            <app-faction-card
              [faction]="f"
              [canEdit]="ctrl.canCreate()"
              (edit)="ctrl.startEdit(f)"
              (remove)="ctrl.confirmRemove(f)"
            />
          } @else {
            <p class="m-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              Select a faction to view details.
            </p>
          }
        </section>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FactionsPage {
  protected readonly service = inject(FactionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly factions = this.service.factions;
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });

  protected readonly ctrl = createEntityListController<Faction, FactionDraft>({
    entities: this.factions,
    service: this.service,
    toDraft: (f) => ({
      slug: f.slug,
      name: f.name,
      type: f.type,
      description: f.description,
      headquarters: f.headquarters,
      relatedCharacters: f.relatedCharacters,
      relatedPlaces: f.relatedPlaces,
    }),
    removeLabel: (f) => f.name,
  });

  protected readonly listItems = computed<ListPaneItem[]>(() =>
    this.factions().map((f) => ({
      id: f.id,
      label: f.name,
      secondary: f.type,
    })),
  );

  constructor() {
    effect(() => {
      const id = this.routeId().get('id');
      this.ctrl.select(id ?? null);
    });

    effect(() => {
      const id = this.ctrl.selectedId();
      const current = this.routeId().get('id') ?? null;
      if (id !== current) {
        void this.router.navigate(id ? ['/factions', id] : ['/factions'], {
          replaceUrl: true,
        });
      }
    });
  }

  protected onSelect(id: string): void {
    void this.router.navigate(['/factions', id]);
  }
}
