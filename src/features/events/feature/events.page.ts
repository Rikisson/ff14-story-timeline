import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  EventCardComponent,
  EventsService,
  TimelineEvent,
  TimelineEventDraft,
} from '@features/events';
import { StoriesService } from '@features/stories';
import { createEntityListController } from '@shared/data-access';
import { PrimaryButtonComponent } from '@shared/ui';
import { EventFormComponent } from '../ui/event-form.component';

@Component({
  selector: 'app-events-page',
  imports: [PrimaryButtonComponent, EventCardComponent, EventFormComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Events</h1>
        @if (ctrl.canCreate() && ctrl.mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="ctrl.startCreate()">+ Add event</button>
        }
      </div>

      @if (ctrl.mode().kind !== 'idle') {
        <app-event-form
          [initial]="ctrl.editingDraft()"
          [busy]="ctrl.busy()"
          [errorMessage]="ctrl.errorMessage()"
          [dateSuggestions]="dateSuggestions()"
          (submitted)="ctrl.submit($event)"
          (cancelled)="ctrl.cancel()"
        />
      }

      @if (events().length === 0) {
        <p class="text-slate-600">No events yet.</p>
      } @else {
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] justify-start gap-4">
          @for (e of events(); track e.id) {
            <li>
              <app-event-card
                [event]="e"
                [canEdit]="ctrl.canCreate()"
                (edit)="ctrl.startEdit(e)"
                (remove)="ctrl.confirmRemove(e)"
              />
            </li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsPage {
  private readonly service = inject(EventsService);
  private readonly storiesService = inject(StoriesService);

  protected readonly events = this.service.events;

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

  protected readonly dateSuggestions = computed<string[]>(() => {
    const dates = new Set<string>();
    for (const s of this.storiesService.publishedStories()) {
      if (s.inGameDate) dates.add(s.inGameDate);
    }
    for (const e of this.events()) {
      if (e.inGameDate) dates.add(e.inGameDate);
    }
    return Array.from(dates).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
  });
}
