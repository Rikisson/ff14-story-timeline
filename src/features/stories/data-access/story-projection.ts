import { CalendarProjectionContext, formatDateSecondary } from '@features/calendar';
import { DirectoryRowInputs, TimelineRowInputs } from '@shared/data-access';
import { isInGameDateEmpty } from '@shared/models';
import { inGameDateSortKey } from '@shared/utils';
import { Story } from './story.types';

/**
 * Pure projection-input builders for Story. Shared by `StoriesService`
 * (live writes) and `ProjectionRebuildService` (chunked rebuilds on
 * calendar config changes — which invalidate every story's
 * `dateSortKey` per `docs/backend-rules.md` *Write discipline*).
 *
 * Reuses `CalendarProjectionContext` and `formatDateSecondary` from
 * the events module since both kinds derive `secondary` from the same
 * in-game-date formatter and both timeline rows share the calendar
 * lookup contract.
 */
export function buildStoryDirectoryInputs(
  entity: Story,
  ctx: CalendarProjectionContext,
): DirectoryRowInputs {
  return {
    label: entity.title,
    coverAssetId: entity.coverAssetId,
    secondary: formatDateSecondary(entity.inGameDate, ctx),
    draft: entity.draft,
  };
}

export function buildStoryTimelineInputs(
  entity: Story,
  ctx: CalendarProjectionContext,
): TimelineRowInputs {
  return {
    title: entity.title,
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
