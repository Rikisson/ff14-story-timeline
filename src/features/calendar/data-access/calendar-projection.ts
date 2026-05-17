import { InGameDate, isInGameDateEmpty } from '@shared/models';
import { formatInGameDate } from '@shared/utils';

/**
 * Calendar context passed to per-kind projection builders (events,
 * stories). Decouples the pure builders from `CalendarService`'s Angular
 * DI so the same code runs inside the live write path, inside
 * `ProjectionRebuildService`, and inside the CLI rebuild script.
 *
 * `CalendarService` exposes lookup callables that match this shape;
 * non-DI callers (rebuild service, seeder, CLI) construct one by hand
 * from raw calendar config.
 */
export interface CalendarProjectionContext {
  eraOrdinalLookup: (id: string) => number | undefined;
  eraNameLookup: (id: string) => string | undefined;
  monthNameLookup: (month: number) => string | undefined;
  weekdayLookup: (date: InGameDate | null | undefined) => string | undefined;
}

/**
 * Resolves the formatted in-game-date string used as `secondary` on
 * Event / Story directory projection rows. Returns `undefined` for
 * empty dates so consumers can fall back cleanly.
 */
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
