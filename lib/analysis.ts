import { addDays, dateKey, DATE_STRING_REGEX } from "./dates";
import { fard, nawafil } from "./prayers";
import type { DayMarks, Log, TrackerAnalysis, TrackerBackup } from "./types";

type AnalysisInput = Pick<TrackerBackup, "startDate" | "logs" | "marks" | "customNawafil" | "qazaDone" | "qazaDoneOn">;

export const calculateTrackerAnalysis = (backup: AnalysisInput, today: string): TrackerAnalysis => {
  const prayerList = [...fard, ...nawafil];
  const bestStreakByPrayer: Record<string, number> = Object.fromEntries(prayerList.map((prayer) => [prayer.id, 0]));
  const currentStreakByPrayer: Record<string, number> = Object.fromEntries(prayerList.map((prayer) => [prayer.id, 0]));
  const qazaByDate: Record<string, number> = {};
  for (const date of Object.values(backup.qazaDoneOn || {})) if (DATE_STRING_REGEX.test(date)) qazaByDate[date] = (qazaByDate[date] || 0) + 1;
  const analysis: TrackerAnalysis = { version: 2, totalFard: 0, totalSunnah: 0, totalNafl: 0, totalPrayers: 0, onTimeFard: 0, onTimeExtras: 0, qazaCompleted: new Set(backup.qazaDone || []).size, daysWithFard: 0, completeFardDays: 0, bestStreakDays: 0, bestStreakPrayerId: null, bestStreakByPrayer, daily: {} };
  if (!DATE_STRING_REGEX.test(backup.startDate)) return analysis;
  let cursor = new Date(`${backup.startDate}T12:00:00`);
  while (dateKey(cursor) <= today) {
    const date = dateKey(cursor);
    const log = backup.logs[date] || {};
    const marks = backup.marks?.[date] || {};
    const customNawafil = backup.customNawafil?.[date] || [];
    const fardCount = fard.filter((prayer) => log[prayer.id]).length;
    const sunnahCount = nawafil.filter((prayer) => prayer.kind === "sunnah" && log[prayer.id]).length;
    const completedCustomNawafil = customNawafil.filter((prayer) => log[prayer.id]);
    const naflCount = nawafil.filter((prayer) => prayer.kind === "nafl" && log[prayer.id]).length + completedCustomNawafil.length;
    const onTimeFard = fard.filter((prayer) => log[prayer.id] && marks[prayer.id]?.completed && marks[prayer.id]?.onTime).length;
    const onTimeExtras = nawafil.filter((prayer) => log[prayer.id] && marks[prayer.id]?.completed && marks[prayer.id]?.onTime).length + completedCustomNawafil.filter((prayer) => marks[prayer.id]?.completed && marks[prayer.id]?.onTime).length;
    const timingSource = Object.values(marks).find((mark) => mark?.timingLocation);
    analysis.totalFard += fardCount; analysis.totalSunnah += sunnahCount; analysis.totalNafl += naflCount;
    analysis.onTimeFard += onTimeFard; analysis.onTimeExtras += onTimeExtras;
    if (fardCount > 0) analysis.daysWithFard++;
    if (fardCount === fard.length) analysis.completeFardDays++;
    analysis.daily[date] = { fard: fardCount, sunnah: sunnahCount, nafl: naflCount, onTimeFard, onTimeExtras, qazaCompleted: qazaByDate[date] || 0, completeFardDay: fardCount === fard.length, timingCity: timingSource?.timingLocation?.city, timingCountry: timingSource?.timingLocation?.country, timingMethod: timingSource?.timingLocation?.method, timezone: timingSource?.timezone };
    for (const prayer of prayerList) {
      if (log[prayer.id]) currentStreakByPrayer[prayer.id]++;
      else currentStreakByPrayer[prayer.id] = 0;
      if (currentStreakByPrayer[prayer.id] > bestStreakByPrayer[prayer.id]) {
        bestStreakByPrayer[prayer.id] = currentStreakByPrayer[prayer.id];
        if (currentStreakByPrayer[prayer.id] > analysis.bestStreakDays) {
          analysis.bestStreakDays = currentStreakByPrayer[prayer.id];
          analysis.bestStreakPrayerId = prayer.id;
        }
      }
    }
    cursor = addDays(cursor, 1);
  }
  analysis.totalPrayers = analysis.totalFard + analysis.totalSunnah + analysis.totalNafl;
  return analysis;
};

export const calculatePrayerStreaks = (
  today: string,
  viewedDay: string,
  viewedLog: Log,
  startDate: string,
  logs: Record<string, Log>,
): Record<string, number> => {
  const completed: Record<string, Set<string>> = Object.fromEntries([...fard, ...nawafil].map((prayer) => [prayer.id, new Set<string>()]));
  for (const [logDate, log] of Object.entries(logs)) {
    if (logDate < startDate || logDate > today) continue;
    for (const prayer of [...fard, ...nawafil]) if (log[prayer.id]) completed[prayer.id].add(logDate);
  }
  if (viewedDay === today) {
    for (const prayer of [...fard, ...nawafil]) {
      if (viewedLog[prayer.id]) completed[prayer.id].add(today);
      else completed[prayer.id].delete(today);
    }
  }
  const yesterday = dateKey(addDays(new Date(`${today}T12:00:00`), -1));
  return Object.fromEntries([...fard, ...nawafil].map((prayer) => {
    const days = completed[prayer.id];
    let cursor = new Date(`${(days.has(today) ? today : yesterday)}T12:00:00`);
    let count = 0;
    while (dateKey(cursor) >= startDate && days.has(dateKey(cursor))) { count++; cursor = addDays(cursor, -1); }
    return [prayer.id, count];
  }));
};

export const mergeTrackerData = (remote: TrackerBackup, local: TrackerBackup): TrackerBackup => {
  const startDate = remote.startDate < local.startDate ? remote.startDate : local.startDate;
  const logs: Record<string, Log> = { ...remote.logs };
  for (const [date, log] of Object.entries(local.logs)) logs[date] = { ...logs[date], ...log };
  const marks: Record<string, DayMarks> = { ...remote.marks };
  for (const [date, dayMarks] of Object.entries(local.marks || {})) marks[date] = { ...marks[date], ...dayMarks };
  const customNawafil: NonNullable<TrackerBackup["customNawafil"]> = { ...remote.customNawafil };
  for (const [date, prayers] of Object.entries(local.customNawafil || {})) customNawafil[date] = [...new Map([...(customNawafil[date] || []), ...prayers].map((prayer) => [prayer.id, prayer])).values()];
  return { startDate, logs, marks, customNawafil, qazaDone: [...new Set([...remote.qazaDone, ...local.qazaDone])], qazaDoneOn: { ...remote.qazaDoneOn, ...local.qazaDoneOn }, profile: local.profile || remote.profile };
};
