import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { MediaAssetsService } from '@features/media';
import { Place, PlaceDraft, PlacesService } from '@features/places';
import { createEntityListController, EntityResolverService } from '@shared/data-access';
import { EntityListPaneComponent, ListPaneItem, PageHeaderComponent } from '@shared/ui';
import { PlaceCardComponent } from '../ui/place-card.component';
import { PlaceFormComponent } from '../ui/place-form.component';
import placeEn from '../i18n/en.json';
import placeUk from '../i18n/uk.json';

@Component({
  selector: 'app-places-page',
  host: { class: 'block h-full' },
  imports: [
    EntityListPaneComponent,
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
            [hasMore]="service.hasMore()"
            [loadingMore]="service.loadingMore()"
            [canCreate]="ctrl.canCreate()"
            [createLabel]="t('action.create')"
            [emptyMessage]="t('empty.list')"
            [ariaLabel]="t('tooltip.list')"
            (select)="onSelect($event)"
            (create)="ctrl.startCreate()"
            (loadMore)="service.loadMore()"
          />

          <section class="flex min-h-0 flex-col md:flex-1" [attr.aria-label]="t('tooltip.details')">
            @if (ctrl.mode().kind === 'create' || ctrl.mode().kind === 'edit') {
              <div class="min-h-0 flex-1 overflow-y-auto">
                <app-place-form
                  [initial]="ctrl.editingDraft()"
                  [busy]="ctrl.busy()"
                  [errorMessage]="ctrl.errorMessage()"
                  (submitted)="ctrl.submit($event)"
                  (cancelled)="ctrl.cancel()"
                />
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
      </div>
    </ng-container>
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
      description: p.description,
      coverAssetId: p.coverAssetId,
      relatedRefs: p.relatedRefs,
    }),
    removeLabel: (p) => p.name,
  });

  private readonly entityResolver = inject(EntityResolverService);
  private readonly media = inject(MediaAssetsService);

  protected readonly listItems = computed<ListPaneItem[]>(() =>
    this.places().map((p) => {
      const firstRef = (p.relatedRefs ?? [])[0];
      const secondary = firstRef
        ? this.entityResolver.resolve(firstRef)?.name
        : undefined;
      return {
        id: p.id,
        label: p.name,
        secondary,
        thumbnailUrl: this.media.urlFor(p.coverAssetId),
      };
    }),
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
