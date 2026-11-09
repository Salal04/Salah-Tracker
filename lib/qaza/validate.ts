import { QAZA_PRAYERS, type QazaOperation, type QazaRecord, type QazaStatistics } from "./types";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isYear = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 9999;

const isCalendarDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const isTimestamp = (value: unknown): value is string =>
  typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && isCalendarDate(value.slice(0, 10))
  && Number.isFinite(Date.parse(value));

const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const isPrayerStats = (value: unknown): boolean => isObject(value)
  && isCount(value.added) && isCount(value.completed) && isCount(value.outstanding)
  && value.completed + value.outstanding <= value.added;

const isYearStats = (value: unknown): boolean => isObject(value)
  && isCount(value.originated) && isCount(value.completed) && isCount(value.outstanding)

export const isQazaRecord = (value: unknown): value is QazaRecord => {
  if (!isObject(value)) return false;
  if (!isNonEmptyString(value.id) || !QAZA_PRAYERS.includes(value.prayer as (typeof QAZA_PRAYERS)[number])) return false;
  if (value.missedDate !== null && !isCalendarDate(value.missedDate)) return false;
  if (!isTimestamp(value.detectedAt) || (value.year !== null && !isYear(value.year))) return false;
  if (value.missedDate && (!isYear(value.year) || Number(value.missedDate.slice(0, 4)) !== value.year)) return false;
  if (value.source !== "auto" && value.source !== "manual") return false;
  if (value.status !== "outstanding" && value.status !== "completed" && value.status !== "pending_confirmation" && value.status !== "offered" && value.status !== "voided") return false;
  if (value.offeredAt !== undefined && !isTimestamp(value.offeredAt)) return false;
  if (value.completedAt !== undefined && !isTimestamp(value.completedAt)) return false;
  if (value.affirmation !== undefined && value.affirmation !== "oath" && value.affirmation !== "none") return false;
  if (value.importId !== undefined && !isNonEmptyString(value.importId)) return false;
  if (value.status === "completed" && !isTimestamp(value.completedAt)) return false;
  if (value.status === "offered" && !isTimestamp(value.offeredAt)) return false;
  return true;
};

export const isQazaOperation = (value: unknown): value is QazaOperation => {
  if (!isObject(value)) return false;
  return isNonEmptyString(value.operationId)
    && (value.type === "ADD_QAZA" || value.type === "COMPLETE_QAZA" || value.type === "CONFIRM_QAZA" || value.type === "CONFIRM_OFFERED" || value.type === "CONFIRM_MISSED" || value.type === "DEFER_CONFIRMATION" || value.type === "ADJUST" || value.type === "ADJUST_QAZA")
    && isNonEmptyString(value.recordId)
    && (value.year === null || isYear(value.year))
    && isTimestamp(value.createdAt)
    && (value.status === "pending" || value.status === "partial" || value.status === "synced" || value.status === "failed")
    && (value.record === undefined || isQazaRecord(value.record))
    && (value.previousRecord === undefined || isQazaRecord(value.previousRecord))
    && (value.adjustmentReason === undefined || value.adjustmentReason === "entered_by_mistake" || value.adjustmentReason === "completed_by_mistake")
    && (value.attemptCount === undefined || isCount(value.attemptCount))
    && (value.nextAttemptAt === undefined || isTimestamp(value.nextAttemptAt))
    && (value.yearWritten === undefined || typeof value.yearWritten === "boolean")
    && (value.statisticsWritten === undefined || typeof value.statisticsWritten === "boolean")
    && (value.syncSlot === undefined || (isObject(value.syncSlot) && (value.syncSlot.kind === "nafl" || (value.syncSlot.kind === "fard" && isNonEmptyString(value.syncSlot.prayerId)))));
};

export const isQazaStatistics = (value: unknown): value is QazaStatistics => {
  if (!isObject(value) || !isCount(value.totalRecords) || !isCount(value.totalAdded) || !isCount(value.totalCompleted) || !isCount(value.totalOutstanding)) return false;
  if (value.totalCompleted + value.totalOutstanding > value.totalAdded) return false;
  if (typeof value.completionPercentage !== "number" || !Number.isFinite(value.completionPercentage) || value.completionPercentage < 0 || value.completionPercentage > 100) return false;
  const byPrayer = value.byPrayer;
  if (!isObject(byPrayer) || !QAZA_PRAYERS.every((prayer) => isPrayerStats(byPrayer[prayer]))) return false;
  const byYear = value.byYear;
  if (!isObject(byYear) || !Object.entries(byYear).every(([year, stats]) => /^\d{4}$/.test(year) && isYear(Number(year)) && isYearStats(stats))) return false;
  const bySource = value.bySource;
  if (!isObject(bySource) || !isCount(bySource.auto) || !isCount(bySource.manual)) return false;
  const completedByAffirmation = value.completedByAffirmation;
  return isObject(completedByAffirmation)
    && isCount(completedByAffirmation.oath)
    && isCount(completedByAffirmation.none);
};
