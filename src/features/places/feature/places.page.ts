import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { Place, PlaceDraft, PlacesService } from '@features/places';
import { UniverseStore } from '@features/universes';
import {
  createEntityDirectoryQueryStore,
  createEntityListController,
} from '@shared/data-access';
import {
  EntityListPaneComponent,
  ListPaneItem,
  PageComponent,
  PageHeaderComponent,
} from '@shared/ui';
import { BackgroundLibraryComponent } from '../ui/background-library.component';
import { PlaceCardComponent } from '../ui/place-card.component';
import { PlaceFormComponent } from '../ui/place-form.component';
import placeEn from '../i18n/en.json';
import placeUk from '../i18n/uk.json';

@Component({
  selector: 'app-places-page',
  host: { class: 'block h-full' },
  imports: [
    BackgroundLibraryComponent,
    EntityListPaneComponent,
    PageComponent,
    PageHeaderComponent,
    PlaceCardComponent,
    PlaceFormComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'place',
      loader: {
        en: () => Promise.resolve(placeEn),
        uk: () => Promise.resolve(placeUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'place'">
      <app-page class="h-full">
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
            [loading]="directory.loading()"
            [error]="directory.error()"
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
              <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
                <app-place-form
                  [initial]="ctrl.editingDraft()"
                  [busy]="ctrl.busy()"
                  [errorMessage]="ctrl.errorMessage()"
                  (submitted)="ctrl.submit($event)"
                  (cancelled)="ctrl.cancel()"
                />
                @if (ctrl.editing(); as p) {
                  <app-place-background-library
                    [placeId]="p.id"
                    [backgrounds]="p.backgrounds ?? []"
                  />
                }
              </div>
            } @else if (ctrl.selected(); as p) {
              <div class="min-h-0 flex-1 overflow-y-auto">
                <app-place-card
                  [place]="p"
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
      </app-page>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlacesPage {
  protected readonly service = inject(PlacesService);
  private readonly universes = inject(UniverseStore);
  private readonly user = inject(AuthStore).user;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });

  private readonly memberView = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly directory = createEntityDirectoryQueryStore({
    universeId: computed(() => this.universes.activeUniverseId()),
    kind: computed(() => 'place' as const),
    includeDrafts: this.memberView,
  });

  protected readonly ctrl = createEntityListController<Place, PlaceDraft>({
    service: this.service,
    kind: 'place',
    lookupById: (id) => this.service.getById(id),
    toDraft: (p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      coverAssetId: p.coverAssetId,
      relatedRefs: p.relatedRefs,
    }),
    removeLabel: (p) => p.name,
  });

  protected readonly listItems = computed<ListPaneItem[]>(() =>
    this.directory.rows().map((row) => ({
      id: row.id,
      label: row.label,
      secondary: row.secondary,
      coverAssetId: row.coverAssetId,
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
