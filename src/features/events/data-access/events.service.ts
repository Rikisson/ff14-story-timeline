import { inject, Injectable } from '@angular/core';
import { CalendarProjectionContext, CalendarService } from '@features/calendar';
import { EntityKind } from '@shared/models';
import {
  DirectoryRowInputs,
  TimelineRowInputs,
  UniverseEntityService,
} from '@shared/data-access';
import {
  buildEventDirectoryInputs,
  buildEventTimelineInputs,
} from './event-projection';
import { TimelineEvent, TimelineEventDraft } from './event.types';

@Injectable({ providedIn: 'root' })
export class EventsService extends UniverseEntityService<TimelineEvent, TimelineEventDraft> {
  protected readonly collectionName = 'events';
  protected readonly kind: EntityKind = 'event';

  private readonly calendar = inject(CalendarService);

  protected toDirectoryInputs(entity: TimelineEvent): DirectoryRowInputs {
    return buildEventDirectoryInputs(entity, this.calendarContext());
  }

  protected override toTimelineInputs(entity: TimelineEvent): TimelineRowInputs {
    return buildEventTimelineInputs(entity, this.calendarContext());
  }

  private calendarContext(): CalendarProjectionContext {
    return {
      eraOrdinalLookup: this.calendar.eraOrdinalLookup,
      eraNameLookup: this.calendar.eraNameLookup,
      monthNameLookup: this.calendar.monthNameLookup,
      weekdayLookup: this.calendar.weekdayLookup,
    };
  }
}
