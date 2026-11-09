import type { ReadableTrackerDayBackup, TrackerDayBackup } from "./types";

/** Upgrade the envelope while preserving existing daily record fields verbatim. */
export function migrateTrackerDayBackup(record: ReadableTrackerDayBackup): TrackerDayBackup {
  if (record.version === 3) return record;
  return { version: 3, date: record.date, log: record.log, marks: record.marks, customNawafil: [] };
}
