import { InGameDate } from '@shared/models';

export type EraOrdinalLookup = (eraId: string) => number | undefined;

/**
 * Fixed-width lexically-sortable encoding of an in-game date for both the
 * `_timelineEntries.dateSortKey` projection field and the client-side
 * `compareInGameDate` ordering. Per `docs/backend-rules.md` *Date sort keys*
 * both paths share the same encoding so Firestore `orderBy('dateSortKey')`
 * and the JS comparator never disagree.
 *
 * Each component is zero-padded to a fixed width. Absent components encode
 * as zeros, so partial dates sort before more-precise dates that share the
 * same prefix (year-only before month-precise; era-only before any
 * year-precise; etc.).
 *
 * Era ordinal mirrors the lookup contract used by `compareInGameDate`:
 * 0-indexed era position, with `undefined`/unknown era collapsing to 0
 * (preserves the existing comparator's behaviour where era-absent and
 * first-era sort equally).
 *
 * Widths are intentionally generous so realistic content never overflows:
 * era 4, year 7, month 2, day 3, hour 4, minute 4, second 4 → 28 digits.
 */
const ERA_WIDTH = 4;
const YEAR_WIDTH = 7;
const MONTH_WIDTH = 2;
const DAY_WIDTH = 3;
const HOUR_WIDTH = 4;
const MINUTE_WIDTH = 4;
const SECOND_WIDTH = 4;

export function inGameDateSortKey(
  date: InGameDate | null | undefined,
  eraOrdinal: EraOrdinalLookup,
): string {
  if (!date) return zeros();
  const era = date.era ? eraOrdinal(date.era) ?? 0 : 0;
  return (
    pad(era, ERA_WIDTH) +
    pad(date.year ?? 0, YEAR_WIDTH) +
    pad(date.month ?? 0, MONTH_WIDTH) +
    pad(date.day ?? 0, DAY_WIDTH) +
    pad(date.hour ?? 0, HOUR_WIDTH) +
    pad(date.minute ?? 0, MINUTE_WIDTH) +
    pad(date.second ?? 0, SECOND_WIDTH)
  );
}

function pad(n: number, width: number): string {
  const v = Math.max(0, Math.floor(n));
  const s = String(v);
  if (s.length >= width) return s;
  return '0'.repeat(width - s.length) + s;
}

function zeros(): string {
  return '0'.repeat(
    ERA_WIDTH + YEAR_WIDTH + MONTH_WIDTH + DAY_WIDTH + HOUR_WIDTH + MINUTE_WIDTH + SECOND_WIDTH,
  );
}
