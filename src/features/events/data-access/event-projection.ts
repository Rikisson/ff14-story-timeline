import { DirectoryRowInputs, TimelineRowInputs } from '@shared/data-access';
import { InGameDate, isInGameDateEmpty } from '@shared/models';
import { formatInGameDate, inGameDateSortKey } from '@shared/utils';
import { TimelineEvent } from './event.types';

/**
 * Calendar context passed to projection builders. Decouples the pure
 * builders from `CalendarService`'s Angular DI so the same code runs
 * inside the live write path and inside `ProjectionRebuildService` /
 * the CLI.
 */
export interface CalendarProjectionContext {
  eraOrdinalLookup: (id: string) => number | undefined;
  eraNameLookup: (id: string) => string | undefined;
  monthNameLookup: (month: number) => string | undefined;
  weekdayLookup: (date: InGameDate | null | undefined) => string | undefined;
}

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
    plotlineIds: (entity.plotlineRefs ?? []).map((r) => r.id),
    characterIds: (entity.relatedRefs ?? [])
      .filter((r) => r.kind === 'character')
      .map((r) => r.id),
    placeIds: (entity.relatedRefs ?? [])
      .filter((r) => r.kind === 'place')
      .map((r) => r.id),
  };
}

export function formatDateSecondary(
  date: InGameDate,
  ctx: CalendarProjectionContext,
): string | undefined {
  if (isInGameDateEmpty(date)) return undefined;
  const formatted = formatInGameDate(date, {
    eraName: date.era ? ctx.eraNameLookup(date.era) : undefined,
    monthName: date.month !== undefined ? ctx.monthNameLookup(date.month) : undefined,
    weekdayName: ctx.weekdayLookup(date),
  });
  return formatted || undefined;
}
