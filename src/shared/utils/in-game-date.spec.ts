import { describe, expect, it } from 'vitest';
import {
  compareInGameDate,
  EraOrdinalLookup,
  formatInGameDate,
  getWeekdayIndex,
  WeekdayResolveOptions,
} from './in-game-date';

// ─── getWeekdayIndex ──────────────────────────────────────────────────────────

const SIMPLE: WeekdayResolveOptions = {
  eras: [{ id: 'e1' }],
  months: [{ days: 30 }, { days: 30 }],
  weekdayCount: 7,
};

describe('getWeekdayIndex', () => {
  it('returns null for a null date', () => {
    expect(getWeekdayIndex(null, SIMPLE)).toBeNull();
  });

  it('returns null when year is missing', () => {
    expect(getWeekdayIndex({ month: 1, day: 1 }, SIMPLE)).toBeNull();
  });

  it('returns null when month is missing', () => {
    expect(getWeekdayIndex({ year: 1, day: 1 }, SIMPLE)).toBeNull();
  });

  it('returns null when day is missing', () => {
    expect(getWeekdayIndex({ year: 1, month: 1 }, SIMPLE)).toBeNull();
  });

  it('returns null when weekdayCount is 0', () => {
    expect(getWeekdayIndex({ year: 1, month: 1, day: 1 }, { ...SIMPLE, weekdayCount: 0 })).toBeNull();
  });

  it('returns null when months list is empty', () => {
    expect(getWeekdayIndex({ year: 1, month: 1, day: 1 }, { ...SIMPLE, months: [] })).toBeNull();
  });

  it('returns null when month index is out of range', () => {
    expect(getWeekdayIndex({ year: 1, month: 0, day: 1 }, SIMPLE)).toBeNull();
    expect(getWeekdayIndex({ year: 1, month: 3, day: 1 }, SIMPLE)).toBeNull();
  });

  it('returns null for unknown era id', () => {
    expect(getWeekdayIndex({ era: 'unknown', year: 1, month: 1, day: 1 }, SIMPLE)).toBeNull();
  });

  it('returns 0 for the first day', () => {
    expect(getWeekdayIndex({ year: 1, month: 1, day: 1 }, SIMPLE)).toBe(0);
  });

  it('increments by 1 each day', () => {
    expect(getWeekdayIndex({ year: 1, month: 1, day: 2 }, SIMPLE)).toBe(1);
    expect(getWeekdayIndex({ year: 1, month: 1, day: 7 }, SIMPLE)).toBe(6);
  });

  it('wraps around at the week boundary', () => {
    expect(getWeekdayIndex({ year: 1, month: 1, day: 8 }, SIMPLE)).toBe(0);
  });

  it('advances across months', () => {
    // month 1 has 30 days → day 31 is month 2, day 1 → offset 30
    expect(getWeekdayIndex({ year: 1, month: 2, day: 1 }, SIMPLE)).toBe(30 % 7);
  });

  it('advances across years', () => {
    // year 2, month 1, day 1 → offset = 60 (2 months × 30 days)
    expect(getWeekdayIndex({ year: 2, month: 1, day: 1 }, SIMPLE)).toBe(60 % 7);
  });

  it('resets weekday count at an era with resetsWeek=true', () => {
    const opts: WeekdayResolveOptions = {
      eras: [{ id: 'e1', maxYears: 10 }, { id: 'e2', resetsWeek: true }],
      months: [{ days: 30 }],
      weekdayCount: 7,
    };
    expect(getWeekdayIndex({ era: 'e2', year: 1, month: 1, day: 1 }, opts)).toBe(0);
  });

  it('accumulates days across eras without resetsWeek', () => {
    const opts: WeekdayResolveOptions = {
      eras: [{ id: 'e1', maxYears: 1 }, { id: 'e2' }],
      months: [{ days: 30 }],
      weekdayCount: 7,
    };
    // e1 has 1 year = 30 days; e2 year 1 day 1 → offset 30
    expect(getWeekdayIndex({ era: 'e2', year: 1, month: 1, day: 1 }, opts)).toBe(30 % 7);
  });

  it('returns null when an intermediate era has no maxYears', () => {
    const opts: WeekdayResolveOptions = {
      eras: [{ id: 'e1' }, { id: 'e2' }],
      months: [{ days: 30 }],
      weekdayCount: 7,
    };
    expect(getWeekdayIndex({ era: 'e2', year: 1, month: 1, day: 1 }, opts)).toBeNull();
  });
});

// ─── compareInGameDate ────────────────────────────────────────────────────────

const noEra: EraOrdinalLookup = () => undefined;
const twoEras: EraOrdinalLookup = (id) => ({ e1: 0, e2: 1 })[id];

describe('compareInGameDate', () => {
  it('returns 0 for two null dates', () => {
    expect(compareInGameDate(null, null, noEra)).toBe(0);
  });

  it('returns 0 for two empty date objects', () => {
    expect(compareInGameDate({}, {}, noEra)).toBe(0);
  });

  it('sorts an empty date after a non-empty date', () => {
    expect(compareInGameDate(null, { year: 1 }, noEra)).toBeGreaterThan(0);
    expect(compareInGameDate({ year: 1 }, null, noEra)).toBeLessThan(0);
  });

  it('compares by era ordinal', () => {
    expect(compareInGameDate({ era: 'e2', year: 1 }, { era: 'e1', year: 1 }, twoEras)).toBeGreaterThan(0);
    expect(compareInGameDate({ era: 'e1', year: 1 }, { era: 'e2', year: 1 }, twoEras)).toBeLessThan(0);
  });

  it('compares by year within the same era', () => {
    expect(compareInGameDate({ year: 2 }, { year: 1 }, noEra)).toBeGreaterThan(0);
    expect(compareInGameDate({ year: 1 }, { year: 2 }, noEra)).toBeLessThan(0);
  });

  it('compares by month within the same year', () => {
    expect(compareInGameDate({ year: 1, month: 2 }, { year: 1, month: 1 }, noEra)).toBeGreaterThan(0);
  });

  it('compares by day within the same month', () => {
    expect(compareInGameDate({ year: 1, month: 1, day: 2 }, { year: 1, month: 1, day: 1 }, noEra)).toBeGreaterThan(0);
  });

  it('compares by hour', () => {
    expect(compareInGameDate({ year: 1, hour: 13 }, { year: 1, hour: 12 }, noEra)).toBeGreaterThan(0);
  });

  it('compares by minute', () => {
    expect(compareInGameDate({ year: 1, minute: 30 }, { year: 1, minute: 29 }, noEra)).toBeGreaterThan(0);
  });

  it('compares by second', () => {
    expect(compareInGameDate({ year: 1, second: 10 }, { year: 1, second: 9 }, noEra)).toBeGreaterThan(0);
  });

  it('returns 0 for identical full dates', () => {
    const d = { year: 1, month: 1, day: 1, hour: 12, minute: 30, second: 0 };
    expect(compareInGameDate(d, { ...d }, noEra)).toBe(0);
  });

});

// ─── formatInGameDate ─────────────────────────────────────────────────────────

describe('formatInGameDate', () => {
  it('returns empty string for null', () => {
    expect(formatInGameDate(null)).toBe('');
  });

  it('returns empty string for an empty date', () => {
    expect(formatInGameDate({})).toBe('');
  });

  it('returns the display field when set, ignoring all other fields', () => {
    expect(formatInGameDate({ year: 99, display: 'Seventh Dawn, Year 1' })).toBe('Seventh Dawn, Year 1');
  });

  it('formats year only', () => {
    expect(formatInGameDate({ year: 5 })).toBe('the year 5');
  });

  it('formats year with era name', () => {
    expect(formatInGameDate({ year: 5 }, { eraName: 'Age of Fire' })).toBe('5 of the Age of Fire');
  });

  it('formats day with month name', () => {
    expect(formatInGameDate({ day: 3, month: 2 }, { monthName: 'Ember' })).toBe('3 Ember');
  });

  it('formats day and numeric month when no month name is given', () => {
    expect(formatInGameDate({ day: 3, month: 2 })).toBe('Day 3, month 02');
  });

  it('formats day only without month', () => {
    expect(formatInGameDate({ day: 7 })).toBe('day 7');
  });

  it('formats month name only', () => {
    expect(formatInGameDate({ month: 2 }, { monthName: 'Ember' })).toBe('Ember');
  });

  it('formats numeric month only', () => {
    expect(formatInGameDate({ month: 2 })).toBe('month 02');
  });

  it('formats full date with day, month name, year, and era', () => {
    expect(formatInGameDate({ year: 1, month: 2, day: 3 }, { eraName: 'AE', monthName: 'Ember' }))
      .toBe('3 Ember of 1, AE');
  });

  it('formats date with day, month name, and year but no era', () => {
    expect(formatInGameDate({ year: 1, month: 2, day: 3 }, { monthName: 'Ember' }))
      .toBe('3 Ember of 1');
  });

  it('formats date with day, month name, and era but no year', () => {
    expect(formatInGameDate({ month: 2, day: 3 }, { eraName: 'AE', monthName: 'Ember' }))
      .toBe('3 Ember, AE');
  });

  it('era name alone when nothing else is provided', () => {
    expect(formatInGameDate({ year: 1 }, { eraName: 'AE' }).includes('AE')).toBe(true);
  });

  it('appends hour when present', () => {
    expect(formatInGameDate({ year: 1, hour: 8 })).toBe('the year 1 — 08');
  });

  it('appends hour and minute with zero-padding', () => {
    expect(formatInGameDate({ year: 1, hour: 8, minute: 5 })).toBe('the year 1 — 08:05');
  });

  it('appends hour, minute, and second', () => {
    expect(formatInGameDate({ year: 1, hour: 8, minute: 5, second: 30 })).toBe('the year 1 — 08:05:30');
  });

  it('omits minute and second when only hour is set', () => {
    expect(formatInGameDate({ year: 1, hour: 23 })).toBe('the year 1 — 23');
  });

  it('prepends weekday name to the formatted body', () => {
    expect(formatInGameDate({ year: 1 }, { weekdayName: 'Fireday' })).toBe('Fireday — the year 1');
  });
});
