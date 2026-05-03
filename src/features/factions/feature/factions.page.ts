import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { createEntityListController } from '@shared/data-access';
import { PrimaryButtonComponent } from '@shared/ui';
import { FactionsService } from '../data-access/factions.service';
import { Faction, FactionDraft } from '../data-access/faction.types';
import { FactionCardComponent } from '../ui/faction-card.component';
import { FactionFormComponent } from '../ui/faction-form.component';

@Component({
  selector: 'app-factions-page',
  imports: [PrimaryButtonComponent, FactionCardComponent, FactionFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Factions</h1>
        @if (ctrl.canCreate() && ctrl.mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="ctrl.startCreate()">+ Add faction</button>
        }
      </div>

      @if (ctrl.mode().kind !== 'idle') {
        <app-faction-form
          [initial]="ctrl.editingDraft()"
          [busy]="ctrl.busy()"
          [errorMessage]="ctrl.errorMessage()"
          (submitted)="ctrl.submit($event)"
          (cancelled)="ctrl.cancel()"
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
                [canEdit]="ctrl.canCreate()"
                (edit)="ctrl.startEdit(f)"
                (remove)="ctrl.confirmRemove(f)"
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
  protected readonly factions = this.service.factions;

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
}
