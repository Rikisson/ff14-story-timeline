export interface InGameDate {
  era?: string;
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
  display?: string;
}

export function isInGameDateEmpty(d: InGameDate | null | undefined): boolean {
  if (!d) return true;
  return (
    d.era === undefined &&
    d.year === undefined &&
    d.month === undefined &&
    d.day === undefined &&
    d.hour === undefined &&
    d.minute === undefined &&
    d.second === undefined &&
    !d.display
  );
}
