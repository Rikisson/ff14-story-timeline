import { describe, it, expect } from 'vitest';
import { Calendar } from './calendar.types';
import { validateInGameDate } from './in-game-date-validation';

const calendar: Calendar = {
  eras: [
    {
      id: 'astral',
      name: 'Astral',
      maxYears: 1000,
      hoursPerDay: 24,
      minutesPerHour: 60,
      secondsPerMinute: 60,
    },
    { id: 'unbounded', name: 'Unbounded', hoursPerDay: 30 },
  ],
  months: [
    { id: 'm1', name: 'Spring', days: 30 },
    { id: 'm2', name: 'Summer', days: 31 },
  ],
};

describe('validateInGameDate', () => {
  it('returns no errors for nullish or empty input', () => {
    expect(validateInGameDate(null, calendar)).toEqual([]);
    expect(validateInGameDate(undefined, calendar)).toEqual([]);
    expect(validateInGameDate({}, calendar)).toEqual([]);
  });

  it('flags year over the era maxYears', () => {
    const errors = validateInGameDate({ era: 'astral', year: 1001 }, calendar);
    expect(errors).toEqual([{ field: 'year', type: 'yearMax', max: 1000 }]);
  });

  it('does not flag year when the era has no maxYears', () => {
    expect(validateInGameDate({ era: 'unbounded', year: 999_999 }, calendar)).toEqual([]);
  });

  it('flags day over the chosen month days', () => {
    const errors = validateInGameDate({ month: 1, day: 31 }, calendar);
    expect(errors).toEqual([{ field: 'day', type: 'dayMax', max: 30 }]);
  });

  it('flags hour over the era hoursPerDay (uses 24h default when no era set)', () => {
    expect(validateInGameDate({ hour: 24 }, calendar)).toEqual([
      { field: 'hour', type: 'hourMax', max: 23 },
    ]);
    expect(validateInGameDate({ era: 'unbounded', hour: 30 }, calendar)).toEqual([
      { field: 'hour', type: 'hourMax', max: 29 },
    ]);
  });

  it('flags minute set without hour and minute over bound', () => {
    expect(validateInGameDate({ minute: 5 }, calendar)).toContainEqual({
      field: 'minute',
      type: 'minuteRequiresHour',
    });
    expect(validateInGameDate({ hour: 1, minute: 60 }, calendar)).toContainEqual({
      field: 'minute',
      type: 'minuteMax',
      max: 59,
    });
  });

  it('flags second set without minute and second over bound', () => {
    expect(validateInGameDate({ hour: 1, second: 5 }, calendar)).toContainEqual({
      field: 'second',
      type: 'secondRequiresMinute',
    });
    expect(validateInGameDate({ hour: 1, minute: 1, second: 60 }, calendar)).toContainEqual({
      field: 'second',
      type: 'secondMax',
      max: 59,
    });
  });

  it('does not flag a fully-valid date', () => {
    expect(
      validateInGameDate(
        { era: 'astral', year: 999, month: 1, day: 15, hour: 13, minute: 45, second: 30 },
        calendar,
      ),
    ).toEqual([]);
  });
});
