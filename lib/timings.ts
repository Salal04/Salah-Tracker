import { addDays, dateKey } from "./dates";
import type { DayTimings } from "./types";

/** Used only when tomorrow's Fajr is absent from the cached monthly schedule. */
export const FALLBACK_NEXT_FAJR_LOCAL_TIME = "06:00:00";

export type PrayerWindow = { start: Date; end: Date };

const parseValidDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const fallbackNextFajr = (timings: DayTimings, ishaTime: string): Date | undefined => {
  const nextDate = dateKey(addDays(new Date(`${timings.date}T12:00:00`), 1));
  const offset = ishaTime.match(/(?:Z|[+-]\d{2}:?\d{2})$/)?.[0] || "";
  return parseValidDate(`${nextDate}T${FALLBACK_NEXT_FAJR_LOCAL_TIME}${offset}`);
};

export const getPrayerWindow = (
  id: string,
  timings: DayTimings | null,
  nextDayFajr?: string,
): PrayerWindow | undefined => {
  if (!timings) return undefined;
  const starts: Record<string, string> = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
  const ends: Record<string, string> = { fajr: "Sunrise", dhuhr: "Asr", asr: "Maghrib", maghrib: "Isha" };
  const startValue = timings.timings[starts[id]];
  const start = parseValidDate(startValue);
  if (!start || !startValue) return undefined;

  const end = id === "isha"
    ? parseValidDate(nextDayFajr) || fallbackNextFajr(timings, startValue)
    : parseValidDate(timings.timings[ends[id]]);
  if (!end) return undefined;
  return { start, end };
};

export const prayerIsOnTime = (
  id: string,
  markedAt: Date,
  timings: DayTimings | null,
  nextDayFajr?: string,
): boolean | undefined => {
  const window = getPrayerWindow(id, timings, nextDayFajr);
  if (!window) return undefined;
  return markedAt >= window.start && markedAt < window.end;
};
