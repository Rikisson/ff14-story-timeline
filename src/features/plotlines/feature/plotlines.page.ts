import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';
import {
  createEntityDirectoryQueryStore,
  createEntityListController,
} from '@shared/data-access';
import {
  ArchivesSelectorComponent,
  ListPaneItem,
  PageComponent,
  SidePaneComponent,
  SidePaneHeaderComponent,
  SidePaneListComponent,
  SidePaneSearchComponent,
} from '@shared/ui';
import { PlotlinesService } from '../data-access/plotlines.service';
import { Plotline, PlotlineDraft, PlotlineStatus } from '../data-access/plotline.types';
import { PlotlineCardComponent } from '../ui/plotline-card.component';
import { PlotlineFormComponent } from '../ui/plotline-form.component';
import { PlotlineMembersComponent } from '../ui/plotline-members.component';
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
    ArchivesSelectorComponent,
    PageComponent,
    PlotlineCardComponent,
    PlotlineFormComponent,
    PlotlineMembersComponent,
    SidePaneComponent,
    SidePaneHeaderComponent,
    SidePaneListComponent,
    SidePaneSearchComponent,
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
      <app-page class="h-full">
        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <app-side-pane class="md:w-80 md:shrink-0" [ariaLabel]="t('tooltip.list')">
            <app-side-pane-header
              [canCreate]="ctrl.canCreate()"
              [createLabel]="t('action.create')"
              (create)="ctrl.startCreate()"
            >
              <app-archives-selector />
            </app-side-pane-header>

            <app-side-pane-search [searchValue]="search()" (searchChange)="search.set($event)" />

            <app-side-pane-list
              [kind]="'plotline'"
              [items]="listItems()"
              [selectedId]="ctrl.selectedId()"
              [hasMore]="directory.hasMore()"
              [loadingMore]="directory.loadingMore()"
              [loading]="directory.loading()"
              [error]="directory.error()"
              [emptyMessage]="t('empty.list')"
              [ariaLabel]="t('tooltip.list')"
              (select)="onSelect($event)"
              (loadMore)="directory.loadMore()"
            />
          </app-side-pane>

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
                <div class="mt-4">
                  <app-plotline-members [plotlineId]="p.id" [canEdit]="ctrl.canCreate()" />
                </div>
              </div>
            } @else {
              <p class="m-0 rounded-lg border border-border bg-surface-subtle px-4 py-12 text-center text-sm text-foreground-faint">
                {{ t('empty.selectDetail') }}
              </p>
            }
          </section>
        </div>
      </app-page>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlotlinesPage {
  protected readonly service = inject(PlotlinesService);
  private readonly universes = inject(UniverseStore);
  private readonly user = inject(AuthStore).user;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });

  private readonly memberView = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly directory = createEntityDirectoryQueryStore({
    universeId: computed(() => this.universes.activeUniverseId()),
    kind: computed(() => 'plotline' as const),
    includeDrafts: this.memberView,
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

  protected readonly search = signal('');

  protected readonly listItems = computed<ListPaneItem[]>(() => {
    this.activeLang();
    const q = this.search().trim().toLowerCase();
    return this.directory
      .rows()
      .map((row) => {
        const status = row.status as PlotlineStatus | undefined;
        return {
          id: row.id,
          label: row.label,
          // The directory projection carries the English status label; the
          // page re-translates via the local `status` field for locale parity.
          secondary: status ? this.transloco.translate(STATUS_KEY[status]) : undefined,
          coverAssetId: row.coverAssetId,
        };
      })
      .filter((item) => q === '' || item.label.toLowerCase().includes(q));
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
