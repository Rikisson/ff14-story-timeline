import { CalendarProjectionContext, formatDateSecondary } from '@features/calendar';
import { DirectoryRowInputs, TimelineRowInputs } from '@shared/data-access';
import { isInGameDateEmpty } from '@shared/models';
import { inGameDateSortKey } from '@shared/utils';
import { TimelineEvent } from './event.types';

/**
 * Pure projection-input builders for TimelineEvent. Shared by
 * `EventsService` (live writes) and `ProjectionRebuildService` (chunked
 * rebuilds on calendar config changes — which invalidate every event's
 * `dateSortKey` per `docs/backend-rules.md` *Write discipline*).
 */
export function buildEventDirectoryInputs(
  entity: TimelineEvent,
  ctx: CalendarProjectionContext,
): DirectoryRowInputs {
  return {
    label: entity.name,
    coverAssetId: entity.coverAssetId,
    secondary: formatDateSecondary(entity.inGameDate, ctx),
  };
}

export function buildEventTimelineInputs(
  entity: TimelineEvent,
  ctx: CalendarProjectionContext,
): TimelineRowInputs {
  return {
    title: entity.name,
    coverAssetId: entity.coverAssetId,
    inGameDate: entity.inGameDate,
    dateSortKey: inGameDateSortKey(entity.inGameDate, ctx.eraOrdinalLookup),
    dateKnown: !isInGameDateEmpty(entity.inGameDate),
    characterIds: (entity.relatedRefs ?? [])
      .filter((r) => r.kind === 'character')
      .map((r) => r.id),
    placeIds: (entity.relatedRefs ?? [])
      .filter((r) => r.kind === 'place')
      .map((r) => r.id),
  };
}
