import { InGameDate, isInGameDateEmpty } from '@shared/models';

export type EraOrdinalLookup = (eraId: string) => number | undefined;

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
}

export function formatInGameDate(
  d: InGameDate | null | undefined,
  options: FormatInGameDateOptions = {},
): string {
  if (!d) return '';
  if (d.display) return d.display;

  const parts: string[] = [];
  const ymd: string[] = [];
  if (d.year !== undefined) ymd.push(String(d.year));
  if (options.monthName) ymd.push(options.monthName);
  else if (d.month !== undefined) ymd.push(pad2(d.month));
  if (d.day !== undefined) ymd.push(pad2(d.day));
  if (ymd.length > 0) parts.push(ymd.join(options.monthName ? ' ' : '-'));

  const time: number[] = [];
  if (d.hour !== undefined) time.push(d.hour);
  if (d.minute !== undefined) time.push(d.minute);
  if (d.second !== undefined) time.push(d.second);
  if (time.length > 0) parts.push(time.map(pad2).join(':'));

  if (options.eraName) parts.push(options.eraName);
  return parts.join(' ').trim();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
