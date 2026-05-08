import { InGameDate, isInGameDateEmpty } from '@shared/models';

export type EraOrdinalLookup = (eraId: string) => number | undefined;

export interface WeekdayResolveOptions {
  eras: ReadonlyArray<{ id: string; maxYears?: number; resetsWeek?: boolean }>;
  months: ReadonlyArray<{ days: number }>;
  weekdayCount: number;
}

export function getWeekdayIndex(
  d: InGameDate | null | undefined,
  options: WeekdayResolveOptions,
): number | null {
  if (!d || d.year === undefined || d.month === undefined || d.day === undefined) return null;
  if (options.weekdayCount <= 0) return null;
  if (options.months.length === 0) return null;
  if (d.month < 1 || d.month > options.months.length) return null;
  if (d.year < 1 || d.day < 1) return null;

  const yearDays = options.months.reduce((sum, m) => sum + m.days, 0);
  if (yearDays <= 0) return null;

  let eraIndex: number;
  if (d.era === undefined) {
    eraIndex = 0;
  } else {
    eraIndex = options.eras.findIndex((e) => e.id === d.era);
    if (eraIndex < 0) return null;
  }
  if (options.eras.length === 0) return null;

  let anchorIndex = 0;
  for (let i = eraIndex; i >= 0; i--) {
    if (options.eras[i].resetsWeek || i === 0) {
      anchorIndex = i;
      break;
    }
  }

  let dayOffset = 0;
  for (let i = anchorIndex; i < eraIndex; i++) {
    const maxYears = options.eras[i].maxYears;
    if (maxYears === undefined) return null;
    dayOffset += maxYears * yearDays;
  }

  dayOffset += (d.year - 1) * yearDays;
  for (let m = 1; m < d.month; m++) {
    dayOffset += options.months[m - 1].days;
  }
  dayOffset += d.day - 1;

  const n = options.weekdayCount;
  return ((dayOffset % n) + n) % n;
}

const SLOT_KEYS = ['year', 'month', 'day', 'hour', 'minute', 'second'] as const;

export function compareInGameDate(
  a: InGameDate | null | undefined,
  b: InGameDate | null | undefined,
  eraOrdinal: EraOrdinalLookup,
): number {
  const aEmpty = isInGameDateEmpty(a);
  const bEmpty = isInGameDateEmpty(b);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  const aOrd = a!.era ? (eraOrdinal(a!.era) ?? 0) : 0;
  const bOrd = b!.era ? (eraOrdinal(b!.era) ?? 0) : 0;
  if (aOrd !== bOrd) return aOrd - bOrd;

  for (const key of SLOT_KEYS) {
    const av = a![key] ?? 0;
    const bv = b![key] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

export interface FormatInGameDateOptions {
  eraName?: string;
  monthName?: string;
  weekdayName?: string;
}

export function formatInGameDate(
  d: InGameDate | null | undefined,
  options: FormatInGameDateOptions = {},
): string {
  if (!d || isInGameDateEmpty(d)) return '';
  if (d.display) return d.display;

  const datePart = buildDatePart(d, options.monthName);
  const yearPart = d.year !== undefined ? String(d.year) : '';
  const timePart = buildTimePart(d);
  const eraName = options.eraName;

  let head: string;
  if (datePart && yearPart && eraName) {
    head = `${datePart} of ${yearPart}, ${eraName}`;
  } else if (datePart && yearPart) {
    head = `${datePart} of ${yearPart}`;
  } else if (datePart && eraName) {
    head = `${datePart}, ${eraName}`;
  } else if (datePart) {
    head = datePart;
  } else if (yearPart && eraName) {
    head = `${yearPart} of the ${eraName}`;
  } else if (yearPart) {
    head = `the year ${yearPart}`;
  } else if (eraName) {
    head = eraName;
  } else {
    head = '';
  }

  let body: string;
  if (!timePart) body = head;
  else body = head ? `${head} — ${timePart}` : timePart;

  if (options.weekdayName && body) return `${options.weekdayName} — ${body}`;
  if (options.weekdayName) return options.weekdayName;
  return body;
}

function buildDatePart(d: InGameDate, monthName: string | undefined): string {
  const day = d.day;
  const month = d.month;
  if (day !== undefined && monthName) return `${day} ${monthName}`;
  if (day !== undefined && month !== undefined) return `Day ${day}, month ${pad2(month)}`;
  if (day !== undefined) return `day ${day}`;
  if (monthName) return monthName;
  if (month !== undefined) return `month ${pad2(month)}`;
  return '';
}

function buildTimePart(d: InGameDate): string {
  if (d.hour === undefined) return '';
  const parts: string[] = [pad2(d.hour)];
  if (d.minute !== undefined) {
    parts.push(pad2(d.minute));
    if (d.second !== undefined) parts.push(pad2(d.second));
  }
  return parts.join(':');
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
