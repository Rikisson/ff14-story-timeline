import { InGameDate } from '@shared/models';
import {
  Calendar,
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_MINUTES_PER_HOUR,
  DEFAULT_SECONDS_PER_MINUTE,
} from './calendar.types';

export type DateErrorField = 'year' | 'day' | 'hour' | 'minute' | 'second';

export type DateErrorType =
  | 'minuteRequiresHour'
  | 'secondRequiresMinute'
  | 'yearMax'
  | 'dayMax'
  | 'hourMax'
  | 'minuteMax'
  | 'secondMax';

export interface DateValidationError {
  field: DateErrorField;
  type: DateErrorType;
  /** Inclusive upper bound for `max`-type errors. */
  max?: number;
}

/**
 * Validate an in-game date against the calendar config. Empty
 * components are not flagged — only set values that violate
 * calendar-derived bounds or the time-cascade rule
 * (minute requires hour, second requires minute).
 */
export function validateInGameDate(
  d: InGameDate | null | undefined,
  calendar: Calendar,
): DateValidationError[] {
  if (!d) return [];
  const errors: DateValidationError[] = [];
  const era = d.era ? calendar.eras.find((e) => e.id === d.era) : undefined;
  const hoursPerDay = era?.hoursPerDay ?? DEFAULT_HOURS_PER_DAY;
  const minutesPerHour = era?.minutesPerHour ?? DEFAULT_MINUTES_PER_HOUR;
  const secondsPerMinute = era?.secondsPerMinute ?? DEFAULT_SECONDS_PER_MINUTE;

  if (era?.maxYears !== undefined && d.year !== undefined && d.year > era.maxYears) {
    errors.push({ field: 'year', type: 'yearMax', max: era.maxYears });
  }

  if (d.month !== undefined && d.day !== undefined) {
    const monthIndex = d.month - 1;
    if (monthIndex >= 0 && monthIndex < calendar.months.length) {
      const monthDays = calendar.months[monthIndex].days;
      if (d.day > monthDays) {
        errors.push({ field: 'day', type: 'dayMax', max: monthDays });
      }
    }
  }

  if (d.hour !== undefined && d.hour > hoursPerDay - 1) {
    errors.push({ field: 'hour', type: 'hourMax', max: hoursPerDay - 1 });
  }

  if (d.minute !== undefined && d.hour === undefined) {
    errors.push({ field: 'minute', type: 'minuteRequiresHour' });
  }
  if (d.minute !== undefined && d.minute > minutesPerHour - 1) {
    errors.push({ field: 'minute', type: 'minuteMax', max: minutesPerHour - 1 });
  }

  if (d.second !== undefined && d.minute === undefined) {
    errors.push({ field: 'second', type: 'secondRequiresMinute' });
  }
  if (d.second !== undefined && d.second > secondsPerMinute - 1) {
    errors.push({ field: 'second', type: 'secondMax', max: secondsPerMinute - 1 });
  }

  return errors;
}
