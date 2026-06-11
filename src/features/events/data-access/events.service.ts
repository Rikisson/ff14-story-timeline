import { inject, Injectable } from '@angular/core';
import { CalendarProjectionContext, CalendarService } from '@features/calendar';
import { ConnectionsService } from '@features/connections';
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
  private readonly connections = inject(ConnectionsService);

  override async remove(id: string): Promise<void> {
    await super.remove(id);
    // Outbound connections belong to the deleted event; inbound ones
    // stay behind as broken edges with editor fix actions. Best-effort:
    // a failed cascade leaves orphans the broken-edge handling covers.
    try {
      await this.connections.deleteOutboundFor({ kind: 'event', id });
    } catch {
      // ignore — broken-edge rendering covers leftovers
    }
  }

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
