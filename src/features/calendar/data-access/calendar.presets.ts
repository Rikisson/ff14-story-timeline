import { Calendar } from './calendar.types';

export const FF14_ERA_SIXTH_ASTRAL_ID = 'era-sixth-astral';
export const FF14_ERA_SEVENTH_UMBRAL_ID = 'era-seventh-umbral';

export const FF14_CALENDAR_PRESET: Calendar = {
  eras: [
    {
      id: FF14_ERA_SIXTH_ASTRAL_ID,
      slug: 'sixth-astral',
      name: 'Sixth Astral Era',
      maxYears: 1577,
      hoursPerDay: 24,
      minutesPerHour: 60,
      secondsPerMinute: 60,
    },
    {
      id: FF14_ERA_SEVENTH_UMBRAL_ID,
      slug: 'seventh-umbral',
      name: 'Seventh Umbral Era',
      hoursPerDay: 24,
      minutesPerHour: 60,
      secondsPerMinute: 60,
      resetsWeek: true,
    },
  ],
  months: [
    { id: 'month-ff14-1-astral', name: '1st Astral Moon', days: 32 },
    { id: 'month-ff14-1-umbral', name: '1st Umbral Moon', days: 32 },
    { id: 'month-ff14-2-astral', name: '2nd Astral Moon', days: 32 },
    { id: 'month-ff14-2-umbral', name: '2nd Umbral Moon', days: 32 },
    { id: 'month-ff14-3-astral', name: '3rd Astral Moon', days: 32 },
    { id: 'month-ff14-3-umbral', name: '3rd Umbral Moon', days: 32 },
    { id: 'month-ff14-4-astral', name: '4th Astral Moon', days: 32 },
    { id: 'month-ff14-4-umbral', name: '4th Umbral Moon', days: 32 },
    { id: 'month-ff14-5-astral', name: '5th Astral Moon', days: 32 },
    { id: 'month-ff14-5-umbral', name: '5th Umbral Moon', days: 32 },
    { id: 'month-ff14-6-astral', name: '6th Astral Moon', days: 32 },
    { id: 'month-ff14-6-umbral', name: '6th Umbral Moon', days: 32 },
  ],
  weekdays: [
    { id: 'weekday-ff14-sun', name: 'Sun Day', short: 'Sun' },
    { id: 'weekday-ff14-moon', name: 'Moon Day', short: 'Moon' },
    { id: 'weekday-ff14-fire', name: 'Fire Day', short: 'Fire' },
    { id: 'weekday-ff14-earth', name: 'Earth Day', short: 'Earth' },
    { id: 'weekday-ff14-water', name: 'Water Day', short: 'Water' },
    { id: 'weekday-ff14-wind', name: 'Wind Day', short: 'Wind' },
    { id: 'weekday-ff14-ice', name: 'Ice Day', short: 'Ice' },
    { id: 'weekday-ff14-lightning', name: 'Lightning Day', short: 'Lightning' },
  ],
};

export const EARTH_ERA_COMMON_ID = 'era-common';

export const EARTH_CALENDAR_PRESET: Calendar = {
  eras: [
    {
      id: EARTH_ERA_COMMON_ID,
      slug: 'common-era',
      name: 'Common Era',
      hoursPerDay: 24,
      minutesPerHour: 60,
      secondsPerMinute: 60,
    },
  ],
  months: [
    { id: 'month-earth-jan', name: 'January', days: 31 },
    { id: 'month-earth-feb', name: 'February', days: 28 },
    { id: 'month-earth-mar', name: 'March', days: 31 },
    { id: 'month-earth-apr', name: 'April', days: 30 },
    { id: 'month-earth-may', name: 'May', days: 31 },
    { id: 'month-earth-jun', name: 'June', days: 30 },
    { id: 'month-earth-jul', name: 'July', days: 31 },
    { id: 'month-earth-aug', name: 'August', days: 31 },
    { id: 'month-earth-sep', name: 'September', days: 30 },
    { id: 'month-earth-oct', name: 'October', days: 31 },
    { id: 'month-earth-nov', name: 'November', days: 30 },
    { id: 'month-earth-dec', name: 'December', days: 31 },
  ],
  weekdays: [
    { id: 'weekday-earth-sun', name: 'Sunday', short: 'Sun' },
    { id: 'weekday-earth-mon', name: 'Monday', short: 'Mon' },
    { id: 'weekday-earth-tue', name: 'Tuesday', short: 'Tue' },
    { id: 'weekday-earth-wed', name: 'Wednesday', short: 'Wed' },
    { id: 'weekday-earth-thu', name: 'Thursday', short: 'Thu' },
    { id: 'weekday-earth-fri', name: 'Friday', short: 'Fri' },
    { id: 'weekday-earth-sat', name: 'Saturday', short: 'Sat' },
  ],
};

export function withFreshCalendarIds(calendar: Calendar): Calendar {
  return {
    eras: calendar.eras.map((e) => ({ ...e, id: crypto.randomUUID() })),
    months: calendar.months.map((m) => ({ ...m, id: crypto.randomUUID() })),
    weekdays: calendar.weekdays?.map((w) => ({ ...w, id: crypto.randomUUID() })),
  };
}
