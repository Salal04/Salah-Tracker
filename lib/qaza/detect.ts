import { DATE_STRING_REGEX } from "../dates";
import type { Log } from "../types";
import type { QazaRepository } from "./repository";
import type { QazaPrayer, QazaRecord } from "./types";

export const QAZA_FARD_PRAYERS: readonly QazaPrayer[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export type DetectMissedFardInput = {
  startDate: string;
  today: string;
  logs: Record<string, Log>;
  nextFajrAt?: string | null;
  repository: QazaRepository;
  now?: Date;
};

const isValidDateKey = (value: string): boolean => {
  if (!DATE_STRING_REGEX.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const nextDate = (date: string): string => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

const isIshaReviewable = (date: string, today: string, nextFajrAt: string | null | undefined, now: Date): boolean => {
  const fajrDate = nextDate(date);
  if (fajrDate < today) return true;
  if (fajrDate > today || !nextFajrAt) return false;
  const fajr = new Date(nextFajrAt);
  return Number.isFinite(fajr.getTime()) && now.getTime() >= fajr.getTime();
};

/**
 * Finds unmarked Fard prayers on dates before today and persists each as a
 * pending-confirmation record. Daily logs are read-only; the repository is
 * used for Qaza records and review progress only.
 */
export const detectMissedFardPrayers = async ({ startDate, today, logs, nextFajrAt, repository, now = new Date() }: DetectMissedFardInput): Promise<QazaRecord[]> => {
  if (!isValidDateKey(startDate) || !isValidDateKey(today) || startDate >= today) return [];

  const created: QazaRecord[] = [];
  for (let date = startDate; date < today; date = nextDate(date)) {
    if (await repository.isDateProcessed(date)) continue;

    const dayLog = logs[date] || {};
    for (const prayer of QAZA_FARD_PRAYERS) {
      if (dayLog[prayer]) continue;
      if (prayer === "isha" && !isIshaReviewable(date, today, nextFajrAt, now)) continue;

      const id = `${date}-${prayer}`;
      if (await repository.getById(id)) continue;
      const record: QazaRecord = {
        id,
        prayer,
        missedDate: date,
        detectedAt: now.toISOString(),
        source: "auto",
        status: "pending_confirmation",
        year: Number(date.slice(0, 4)),
      };
      await repository.putRecords([record]);
      created.push(record);
    }

    const ishaPendingReview = !dayLog.isha && !isIshaReviewable(date, today, nextFajrAt, now);
    if (!ishaPendingReview) await repository.markDateProcessed(date);
  }
  return created;
};
