export interface CalendarEra {
  id: string;
  slug?: string;
  name: string;
  maxYears?: number;
  hoursPerDay?: number;
  minutesPerHour?: number;
  secondsPerMinute?: number;
  description?: string;
}

export interface CalendarMonth {
  id: string;
  name: string;
  days: number;
  description?: string;
}

export interface Calendar {
  eras: CalendarEra[];
  months: CalendarMonth[];
  updatedAt?: number;
}

export const EMPTY_CALENDAR: Calendar = { eras: [], months: [] };

export const DEFAULT_HOURS_PER_DAY = 24;
export const DEFAULT_MINUTES_PER_HOUR = 60;
export const DEFAULT_SECONDS_PER_MINUTE = 60;
