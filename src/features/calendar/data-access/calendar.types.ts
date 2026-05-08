export interface CalendarEra {
  id: string;
  slug?: string;
  name: string;
  maxYears?: number;
  hoursPerDay?: number;
  minutesPerHour?: number;
  secondsPerMinute?: number;
  description?: string;
  resetsWeek?: boolean;
}

export interface CalendarMonth {
  id: string;
  name: string;
  days: number;
  description?: string;
}

export interface CalendarWeekday {
  id: string;
  name: string;
  short?: string;
  slug?: string;
  description?: string;
}

export interface Calendar {
  eras: CalendarEra[];
  months: CalendarMonth[];
  weekdays?: CalendarWeekday[];
  updatedAt?: number;
}

export const EMPTY_CALENDAR: Calendar = { eras: [], months: [], weekdays: [] };

export const DEFAULT_HOURS_PER_DAY = 24;
export const DEFAULT_MINUTES_PER_HOUR = 60;
export const DEFAULT_SECONDS_PER_MINUTE = 60;
