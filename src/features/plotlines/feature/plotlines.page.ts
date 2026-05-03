import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { createEntityListController } from '@shared/data-access';
import { EntityListPaneComponent, ListPaneItem, PageHeaderComponent } from '@shared/ui';
import { PlotlinesService } from '../data-access/plotlines.service';
import { Plotline, PlotlineDraft } from '../data-access/plotline.types';
import { PlotlineCardComponent } from '../ui/plotline-card.component';
import { PlotlineFormComponent } from '../ui/plotline-form.component';

@Component({
  selector: 'app-plotlines-page',
  imports: [EntityListPaneComponent, PageHeaderComponent, PlotlineCardComponent, PlotlineFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <app-page-header title="Plotlines" />

      <div class="grid gap-4 md:grid-cols-[320px_1fr]">
        <app-entity-list-pane
          [items]="listItems()"
          [selectedId]="ctrl.selectedId()"
          [hasMore]="service.hasMore()"
          [loadingMore]="service.loadingMore()"
          [canCreate]="ctrl.canCreate()"
          createLabel="+ Add plotline"
          emptyMessage="No plotlines yet."
          ariaLabel="Plotlines list"
          (select)="onSelect($event)"
          (create)="ctrl.startCreate()"
          (loadMore)="service.loadMore()"
        />

        <section class="flex flex-col gap-3" aria-label="Plotline details">
          @if (ctrl.mode().kind === 'create' || ctrl.mode().kind === 'edit') {
            <app-plotline-form
              [initial]="ctrl.editingDraft()"
              [busy]="ctrl.busy()"
              [errorMessage]="ctrl.errorMessage()"
              (submitted)="ctrl.submit($event)"
              (cancelled)="ctrl.cancel()"
            />
          } @else if (ctrl.selected(); as p) {
            <app-plotline-card
              [plotline]="p"
              [canEdit]="ctrl.canCreate()"
              (edit)="ctrl.startEdit(p)"
              (remove)="ctrl.confirmRemove(p)"
            />
          } @else {
            <p class="m-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              Select a plotline to view details.
            </p>
          }
        </section>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlotlinesPage {
  protected readonly service = inject(PlotlinesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly plotlines = this.service.plotlines;
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });

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

  protected readonly listItems = computed<ListPaneItem[]>(() =>
    this.plotlines().map((p) => ({
      id: p.id,
      label: p.title,
      secondary: p.status,
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
        void this.router.navigate(id ? ['/plotlines', id] : ['/plotlines'], {
          replaceUrl: true,
        });
      }
    });
  }

  protected onSelect(id: string): void {
    void this.router.navigate(['/plotlines', id]);
  }
}
