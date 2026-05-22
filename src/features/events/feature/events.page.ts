import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import {
  EventCardComponent,
  EventsService,
  TimelineEvent,
  TimelineEventDraft,
} from '@features/events';
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
import { EventFormComponent } from '../ui/event-form.component';
import eventEn from '../i18n/en.json';
import eventUk from '../i18n/uk.json';

@Component({
  selector: 'app-events-page',
  host: { class: 'block h-full' },
  imports: [
    EntityListPaneComponent,
    EventCardComponent,
    EventFormComponent,
    PageComponent,
    PageHeaderComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'event',
      loader: {
        en: () => Promise.resolve(eventEn),
        uk: () => Promise.resolve(eventUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'event'">
      <app-page class="h-full">
        <app-page-header
          [title]="t('field.pageTitle')"
          [subtitle]="t('field.pageSubtitle')"
        />

        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <app-entity-list-pane
            class="md:w-80 md:shrink-0"
            [kind]="'event'"
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
              <div class="min-h-0 flex-1 overflow-y-auto">
                <app-event-form
                  [initial]="ctrl.editingDraft()"
                  [busy]="ctrl.busy()"
                  [errorMessage]="ctrl.errorMessage()"
                  (submitted)="ctrl.submit($event)"
                  (cancelled)="ctrl.cancel()"
                />
              </div>
            } @else if (ctrl.selected(); as e) {
              <div class="min-h-0 flex-1 overflow-y-auto">
                <app-event-card
                  [event]="e"
                  [canEdit]="ctrl.canCreate()"
                  (edit)="ctrl.startEdit(e)"
                  (remove)="ctrl.confirmRemove(e)"
                />
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
export class EventsPage {
  protected readonly service = inject(EventsService);
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
    kind: computed(() => 'event' as const),
    includeDrafts: this.memberView,
  });

  protected readonly ctrl = createEntityListController<TimelineEvent, TimelineEventDraft>({
    service: this.service,
    lookupById: (id) => this.service.getById(id),
    toDraft: (e) => ({
      slug: e.slug,
      name: e.name,
      description: e.description,
      coverAssetId: e.coverAssetId,
      bgmAssetId: e.bgmAssetId,
      backgroundEffect: e.backgroundEffect,
      inGameDate: e.inGameDate,
      relatedRefs: e.relatedRefs,
      plotlineRefs: e.plotlineRefs,
      nextRefs: e.nextRefs,
    }),
    removeLabel: (e) => e.name,
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
        void this.router.navigate(id ? ['/events', id] : ['/events'], {
          replaceUrl: true,
        });
      }
    });
  }

  protected onSelect(id: string): void {
    void this.router.navigate(['/events', id]);
  }
}
