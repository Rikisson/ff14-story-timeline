import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Place, PlaceDraft, PlacesService } from '@features/places';
import { createEntityListController } from '@shared/data-access';
import { EntityListPaneComponent, ListPaneItem, PageHeaderComponent } from '@shared/ui';
import { PlaceCardComponent } from '../ui/place-card.component';
import { PlaceFormComponent } from '../ui/place-form.component';

@Component({
  selector: 'app-places-page',
  imports: [EntityListPaneComponent, PageHeaderComponent, PlaceCardComponent, PlaceFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <app-page-header title="Places" />

      <div class="grid gap-4 md:grid-cols-[320px_1fr]">
        <app-entity-list-pane
          [items]="listItems()"
          [selectedId]="ctrl.selectedId()"
          [hasMore]="service.hasMore()"
          [loadingMore]="service.loadingMore()"
          [canCreate]="ctrl.canCreate()"
          createLabel="+ Add place"
          emptyMessage="No places yet."
          ariaLabel="Places list"
          (select)="onSelect($event)"
          (create)="ctrl.startCreate()"
          (loadMore)="service.loadMore()"
        />

        <section class="flex flex-col gap-3" aria-label="Place details">
          @if (ctrl.mode().kind === 'create' || ctrl.mode().kind === 'edit') {
            <app-place-form
              [initial]="ctrl.editingDraft()"
              [busy]="ctrl.busy()"
              [errorMessage]="ctrl.errorMessage()"
              (submitted)="ctrl.submit($event)"
              (cancelled)="ctrl.cancel()"
            />
          } @else if (ctrl.selected(); as p) {
            <app-place-card
              [place]="p"
              [canEdit]="ctrl.canCreate()"
              (edit)="ctrl.startEdit(p)"
              (remove)="ctrl.confirmRemove(p)"
            />
          } @else {
            <p class="m-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              Select a place to view details.
            </p>
          }
        </section>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlacesPage {
  protected readonly service = inject(PlacesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly places = this.service.places;
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });

  protected readonly ctrl = createEntityListController<Place, PlaceDraft>({
    entities: this.places,
    service: this.service,
    toDraft: (p) => ({
      slug: p.slug,
      name: p.name,
      geoPosition: p.geoPosition,
      factions: p.factions,
    }),
    removeLabel: (p) => p.name,
  });

  protected readonly listItems = computed<ListPaneItem[]>(() =>
    this.places().map((p) => ({
      id: p.id,
      label: p.name,
      secondary: p.geoPosition || undefined,
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
        void this.router.navigate(id ? ['/places', id] : ['/places'], {
          replaceUrl: true,
        });
      }
    });
  }

  protected onSelect(id: string): void {
    void this.router.navigate(['/places', id]);
  }
}
