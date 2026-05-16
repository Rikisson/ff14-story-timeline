import { inject, Injectable } from '@angular/core';
import { CalendarService } from '@features/calendar';
import { EntityKind, isInGameDateEmpty } from '@shared/models';
import {
  DirectoryRowInputs,
  TimelineRowInputs,
  UniverseEntityService,
} from '@shared/data-access';
import { formatInGameDate, inGameDateSortKey } from '@shared/utils';
import { TimelineEvent, TimelineEventDraft } from './event.types';

@Injectable({ providedIn: 'root' })
export class EventsService extends UniverseEntityService<TimelineEvent, TimelineEventDraft> {
  protected readonly collectionName = 'events';
  protected readonly kind: EntityKind = 'event';

  private readonly calendar = inject(CalendarService);

  readonly events = this.entitiesSignal;

  protected toDirectoryInputs(entity: TimelineEvent): DirectoryRowInputs {
    return {
      label: entity.name,
      coverAssetId: entity.coverAssetId,
      secondary: this.formatDateSecondary(entity),
    };
  }

  protected override toTimelineInputs(entity: TimelineEvent): TimelineRowInputs {
    return {
      title: entity.name,
      coverAssetId: entity.coverAssetId,
      inGameDate: entity.inGameDate,
      dateSortKey: inGameDateSortKey(entity.inGameDate, this.calendar.eraOrdinalLookup),
      dateKnown: !isInGameDateEmpty(entity.inGameDate),
      plotlineIds: (entity.plotlineRefs ?? []).map((r) => r.id),
      characterIds: (entity.relatedRefs ?? [])
        .filter((r) => r.kind === 'character')
        .map((r) => r.id),
      placeIds: (entity.relatedRefs ?? [])
        .filter((r) => r.kind === 'place')
        .map((r) => r.id),
    };
  }

  private formatDateSecondary(entity: TimelineEvent): string | undefined {
    if (isInGameDateEmpty(entity.inGameDate)) return undefined;
    const formatted = formatInGameDate(entity.inGameDate, {
      eraName: entity.inGameDate.era ? this.calendar.eraNameLookup(entity.inGameDate.era) : undefined,
      monthName:
        entity.inGameDate.month !== undefined
          ? this.calendar.monthNameLookup(entity.inGameDate.month)
          : undefined,
      weekdayName: this.calendar.weekdayLookup(entity.inGameDate),
    });
    return formatted || undefined;
  }
}
