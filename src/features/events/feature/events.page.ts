import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { CalendarService } from '@features/calendar';
import {
  EventCardComponent,
  EventsService,
  TimelineEvent,
  TimelineEventDraft,
} from '@features/events';
import { createEntityListController } from '@shared/data-access';
import { isInGameDateEmpty } from '@shared/models';
import { EntityListPaneComponent, ListPaneItem, PageHeaderComponent } from '@shared/ui';
import { formatInGameDate } from '@shared/utils';
import { EventFormComponent } from '../ui/event-form.component';

@Component({
  selector: 'app-events-page',
  imports: [EntityListPaneComponent, EventCardComponent, EventFormComponent, PageHeaderComponent],
  template: `
    <div class="flex flex-col gap-4">
      <app-page-header title="Events" />

      <div class="grid gap-4 md:grid-cols-[320px_1fr]">
        <app-entity-list-pane
          [items]="listItems()"
          [selectedId]="ctrl.selectedId()"
          [hasMore]="service.hasMore()"
          [loadingMore]="service.loadingMore()"
          [canCreate]="ctrl.canCreate()"
          createLabel="+ Add event"
          emptyMessage="No events yet."
          ariaLabel="Events list"
          (select)="onSelect($event)"
          (create)="ctrl.startCreate()"
          (loadMore)="service.loadMore()"
        />

        <section class="flex flex-col gap-3" aria-label="Event details">
          @if (ctrl.mode().kind === 'create' || ctrl.mode().kind === 'edit') {
            <app-event-form
              [initial]="ctrl.editingDraft()"
              [busy]="ctrl.busy()"
              [errorMessage]="ctrl.errorMessage()"
              (submitted)="ctrl.submit($event)"
              (cancelled)="ctrl.cancel()"
            />
          } @else if (ctrl.selected(); as e) {
            <app-event-card
              [event]="e"
              [canEdit]="ctrl.canCreate()"
              (edit)="ctrl.startEdit(e)"
              (remove)="ctrl.confirmRemove(e)"
            />
          } @else {
            <p class="m-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              Select an event to view details.
            </p>
          }
        </section>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsPage {
  protected readonly service = inject(EventsService);
  private readonly calendar = inject(CalendarService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly events = this.service.events;
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });

  protected readonly ctrl = createEntityListController<TimelineEvent, TimelineEventDraft>({
    entities: this.events,
    service: this.service,
    toDraft: (e) => ({
      slug: e.slug,
      name: e.name,
      description: e.description,
      mainCharacters: e.mainCharacters,
      places: e.places,
      inGameDate: e.inGameDate,
      relatedDates: e.relatedDates,
      type: e.type,
      summary: e.summary,
      sortOrder: e.sortOrder,
      consequences: e.consequences,
      relatedEvents: e.relatedEvents,
      plotlineRefs: e.plotlineRefs,
      itemRefs: e.itemRefs,
      factionRefs: e.factionRefs,
    }),
    removeLabel: (e) => e.name,
  });

  protected readonly listItems = computed<ListPaneItem[]>(() =>
    this.events().map((e) => ({
      id: e.id,
      label: e.name,
      secondary: this.formatDateLabel(e),
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

  private formatDateLabel(e: TimelineEvent): string | undefined {
    if (isInGameDateEmpty(e.inGameDate)) return undefined;
    return (
      formatInGameDate(e.inGameDate, {
        eraName: e.inGameDate.era ? this.calendar.eraNameLookup(e.inGameDate.era) : undefined,
        monthName: e.inGameDate.month
          ? this.calendar.monthNameLookup(e.inGameDate.month)
          : undefined,
      }) || undefined
    );
  }
}
