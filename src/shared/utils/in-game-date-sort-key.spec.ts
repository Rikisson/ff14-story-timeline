import { describe, expect, it } from 'vitest';
import { InGameDate } from '@shared/models';
import { compareInGameDate } from './in-game-date';
import { EraOrdinalLookup, inGameDateSortKey } from './in-game-date-sort-key';

const ERAS = ['e0', 'e1', 'e2'];
const eraOrdinal: EraOrdinalLookup = (id) => {
  const i = ERAS.indexOf(id);
  return i < 0 ? undefined : i;
};

function compareKeys(a: InGameDate | null | undefined, b: InGameDate | null | undefined): number {
  const ak = inGameDateSortKey(a, eraOrdinal);
  const bk = inGameDateSortKey(b, eraOrdinal);
  if (ak < bk) return -1;
  if (ak > bk) return 1;
  return 0;
}

describe('inGameDateSortKey', () => {
  it('produces a fixed-width key of 28 digits', () => {
    expect(inGameDateSortKey({ era: 'e1', year: 1577, month: 3, day: 15 }, eraOrdinal)).toHaveLength(28);
  });

  it('encodes absent components as zeros', () => {
    expect(inGameDateSortKey({}, eraOrdinal)).toBe('0'.repeat(28));
  });

  it('treats null / undefined as all-zeros', () => {
    expect(inGameDateSortKey(null, eraOrdinal)).toBe('0'.repeat(28));
    expect(inGameDateSortKey(undefined, eraOrdinal)).toBe('0'.repeat(28));
  });

  it('orders by era first', () => {
    const a = inGameDateSortKey({ era: 'e1', year: 9999 }, eraOrdinal);
    const b = inGameDateSortKey({ era: 'e2', year: 1 }, eraOrdinal);
    expect(a < b).toBe(true);
  });

  it('orders era-only before any year-precise event in the same era', () => {
    expect(compareKeys({ era: 'e1' }, { era: 'e1', year: 1 })).toBeLessThan(0);
  });

  it('orders year-only before month-precise event in same year', () => {
    expect(compareKeys({ era: 'e1', year: 1577 }, { era: 'e1', year: 1577, month: 1 })).toBeLessThan(0);
  });

  it('orders month-only before day-precise in same month', () => {
    expect(
      compareKeys(
        { era: 'e1', year: 1577, month: 3 },
        { era: 'e1', year: 1577, month: 3, day: 1 },
      ),
    ).toBeLessThan(0);
  });

  it('time cascade: hour-precise sorts before minute/second-precise of same hour', () => {
    expect(
      compareKeys(
        { era: 'e1', year: 1, month: 1, day: 1, hour: 12 },
        { era: 'e1', year: 1, month: 1, day: 1, hour: 12, minute: 30 },
      ),
    ).toBeLessThan(0);
  });

  it('collapses absent era and first era to the same ordinal (matches compareInGameDate)', () => {
    expect(
      compareKeys({ year: 100 }, { era: 'e0', year: 100 }),
    ).toBe(0);
  });

  it('collapses unknown era id to zero (matches compareInGameDate fallback)', () => {
    expect(compareKeys({ era: 'mystery', year: 1 }, { era: 'e0', year: 1 })).toBe(0);
  });

  it('full equality returns identical keys', () => {
    const d: InGameDate = { era: 'e2', year: 1577, month: 7, day: 13, hour: 13, minute: 45, second: 30 };
    expect(inGameDateSortKey(d, eraOrdinal)).toBe(inGameDateSortKey({ ...d }, eraOrdinal));
  });

  it('handles wide values without overflowing the field', () => {
    const key = inGameDateSortKey({ era: 'e2', year: 9_999_999 }, eraOrdinal);
    expect(key.startsWith('00029999999')).toBe(true);
  });
});

// Sanity that the comparator we just refactored still produces the same
// ordering as a raw key comparison for non-empty dates.
describe('compareInGameDate ↔ inGameDateSortKey parity', () => {
  const dates: InGameDate[] = [
    { era: 'e0', year: 1 },
    { era: 'e0', year: 1, month: 6 },
    { era: 'e1', year: 1 },
    { era: 'e1', year: 1, month: 1, day: 1 },
    { era: 'e1', year: 1, month: 1, day: 1, hour: 12 },
    { era: 'e2', year: 1577, month: 7, day: 13, hour: 13, minute: 45, second: 30 },
    { era: 'e2', year: 1577, month: 7, day: 13, hour: 13, minute: 45, second: 31 },
  ];

  it('produces a consistent total order with the comparator', () => {
    for (let i = 0; i < dates.length; i++) {
      for (let j = 0; j < dates.length; j++) {
        const cmp = compareInGameDate(dates[i], dates[j], eraOrdinal);
        const key = compareKeys(dates[i], dates[j]);
        expect(Math.sign(cmp)).toBe(Math.sign(key));
      }
    }
  });

  it('places empty dates after non-empty ones in the comparator (sort key alone cannot)', () => {
    expect(compareInGameDate({}, { era: 'e0', year: 1 }, eraOrdinal)).toBeGreaterThan(0);
    expect(compareInGameDate({ era: 'e0', year: 1 }, {}, eraOrdinal)).toBeLessThan(0);
  });
});
