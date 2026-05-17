import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { UniverseStore } from '@features/universes';
import {
  createEntityDirectoryQueryStore,
  createEntityListController,
} from '@shared/data-access';
import { EntityListPaneComponent, ListPaneItem, PageHeaderComponent } from '@shared/ui';
import { PlotlinesService } from '../data-access/plotlines.service';
import { Plotline, PlotlineDraft, PlotlineStatus } from '../data-access/plotline.types';
import { PlotlineCardComponent } from '../ui/plotline-card.component';
import { PlotlineFormComponent } from '../ui/plotline-form.component';
import plotlineEn from '../i18n/en.json';
import plotlineUk from '../i18n/uk.json';

const STATUS_KEY: Record<PlotlineStatus, string> = {
  planned: 'plotline.field.statusPlanned',
  active: 'plotline.field.statusActive',
  resolved: 'plotline.field.statusResolved',
};

@Component({
  selector: 'app-plotlines-page',
  host: { class: 'block h-full' },
  imports: [
    EntityListPaneComponent,
    PageHeaderComponent,
    PlotlineCardComponent,
    PlotlineFormComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'plotline',
      loader: {
        en: () => Promise.resolve(plotlineEn),
        uk: () => Promise.resolve(plotlineUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'plotline'">
      <div class="flex h-full flex-col gap-4">
        <app-page-header
          [title]="t('field.pageTitle')"
          [subtitle]="t('field.pageSubtitle')"
        />

        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <app-entity-list-pane
            class="md:w-80 md:shrink-0"
            [items]="listItems()"
            [selectedId]="ctrl.selectedId()"
            [hasMore]="directory.hasMore()"
            [loadingMore]="directory.loadingMore()"
            [canCreate]="ctrl.canCreate()"
            [createLabel]="t('action.create')"
            [emptyMessage]="t('empty.list')"
            [ariaLabel]="t('tooltip.list')"
            (select)="onSelect($event)"
            (create)="ctrl.startCreate()"
            (loadMore)="directory.loadMore()"
          />

          <section class="flex min-h-0 flex-col md:flex-1" [attr.aria-label]="t('tooltip.details')">
            @if (ctrl.mode().kind === 'create' || ctrl.mode().kind === 'edit') {
              <div class="min-h-0 flex-1 overflow-y-auto">
                <app-plotline-form
                  [initial]="ctrl.editingDraft()"
                  [busy]="ctrl.busy()"
                  [errorMessage]="ctrl.errorMessage()"
                  (submitted)="ctrl.submit($event)"
                  (cancelled)="ctrl.cancel()"
                />
              </div>
            } @else if (ctrl.selected(); as p) {
              <div class="min-h-0 flex-1 overflow-y-auto">
                <app-plotline-card
                  [plotline]="p"
                  [canEdit]="ctrl.canCreate()"
                  (edit)="ctrl.startEdit(p)"
                  (remove)="ctrl.confirmRemove(p)"
                />
              </div>
            } @else {
              <p class="m-0 rounded-lg border border-dashed border-border-strong bg-surface-subtle px-4 py-12 text-center text-sm text-foreground-faint">
                {{ t('empty.selectDetail') }}
              </p>
            }
          </section>
        </div>
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlotlinesPage {
  protected readonly service = inject(PlotlinesService);
  private readonly universes = inject(UniverseStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });

  protected readonly directory = createEntityDirectoryQueryStore({
    universeId: computed(() => this.universes.activeUniverseId()),
    kind: computed(() => 'plotline' as const),
    includeDrafts: computed(() => true),
  });

  protected readonly ctrl = createEntityListController<Plotline, PlotlineDraft>({
    service: this.service,
    lookupById: (id) => this.service.getById(id),
    toDraft: (p) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      coverAssetId: p.coverAssetId,
      color: p.color,
      status: p.status,
    }),
    removeLabel: (p) => p.title,
  });

  protected readonly listItems = computed<ListPaneItem[]>(() => {
    this.activeLang();
    return this.directory.rows().map((row) => {
      const status = row.status as PlotlineStatus | undefined;
      return {
        id: row.id,
        label: row.label,
        // The directory projection carries the English status label; the
        // page re-translates via the local `status` field for locale parity.
        secondary: status ? this.transloco.translate(STATUS_KEY[status]) : undefined,
        coverAssetId: row.coverAssetId,
      };
    });
  });

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
