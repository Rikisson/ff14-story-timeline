import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { createEntityListController } from '@shared/data-access';
import { PrimaryButtonComponent } from '@shared/ui';
import { PlotlinesService } from '../data-access/plotlines.service';
import { Plotline, PlotlineDraft } from '../data-access/plotline.types';
import { PlotlineCardComponent } from '../ui/plotline-card.component';
import { PlotlineFormComponent } from '../ui/plotline-form.component';

@Component({
  selector: 'app-plotlines-page',
  imports: [PrimaryButtonComponent, PlotlineCardComponent, PlotlineFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Plotlines</h1>
        @if (ctrl.canCreate() && ctrl.mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="ctrl.startCreate()">+ Add plotline</button>
        }
      </div>

      @if (ctrl.mode().kind !== 'idle') {
        <app-plotline-form
          [initial]="ctrl.editingDraft()"
          [busy]="ctrl.busy()"
          [errorMessage]="ctrl.errorMessage()"
          (submitted)="ctrl.submit($event)"
          (cancelled)="ctrl.cancel()"
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
export class PlotlinesPage {
  private readonly service = inject(PlotlinesService);
  protected readonly plotlines = this.service.plotlines;

  protected readonly ctrl = createEntityListController<Plotline, PlotlineDraft>({
    entities: this.plotlines,
    service: this.service,
    toDraft: (p) => ({
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      color: p.color,
      status: p.status,
    }),
    removeLabel: (p) => p.title,
  });
}
