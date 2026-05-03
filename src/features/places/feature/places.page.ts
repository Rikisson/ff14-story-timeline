import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Place, PlaceDraft, PlacesService } from '@features/places';
import { createEntityListController } from '@shared/data-access';
import { PrimaryButtonComponent } from '@shared/ui';
import { PlaceCardComponent } from '../ui/place-card.component';
import { PlaceFormComponent } from '../ui/place-form.component';

@Component({
  selector: 'app-places-page',
  imports: [PrimaryButtonComponent, PlaceCardComponent, PlaceFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Places</h1>
        @if (ctrl.canCreate() && ctrl.mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="ctrl.startCreate()">+ Add place</button>
        }
      </div>

      @if (ctrl.mode().kind !== 'idle') {
        <app-place-form
          [initial]="ctrl.editingDraft()"
          [busy]="ctrl.busy()"
          [errorMessage]="ctrl.errorMessage()"
          (submitted)="ctrl.submit($event)"
          (cancelled)="ctrl.cancel()"
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
                [canEdit]="ctrl.canCreate()"
                (edit)="ctrl.startEdit(p)"
                (remove)="ctrl.confirmRemove(p)"
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
  protected readonly places = this.service.places;

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
}
