import type { QazaOperation, QazaRecord } from "../qaza/types";
import type { ReadableTrackerDayBackup, TrackerSummary } from "../types";

const completed = (record: QazaRecord) => record.status === "completed";
export function mergeQazaYear(left: QazaRecord[], right: QazaRecord[]): QazaRecord[] {
  const merged = new Map<string, QazaRecord>();
  for (const record of [...left, ...right]) {
    const old = merged.get(record.id);
    if (!old) { merged.set(record.id, record); continue; }
    const winner = (record.adjustments?.length || 0) !== (old.adjustments?.length || 0) ? ((record.adjustments?.length || 0) > (old.adjustments?.length || 0) ? record : old)
      : completed(old) !== completed(record) ? (completed(old) ? old : record)
      : Date.parse(record.completedAt || record.detectedAt) > Date.parse(old.completedAt || old.detectedAt) ? record : old;
    merged.set(record.id, winner);
  }
  return [...merged.values()];
}

export function mergeQazaOperations(left: QazaOperation[], right: QazaOperation[]): QazaOperation[] {
  const merged = new Map<string, QazaOperation>();
  for (const operation of [...left, ...right]) merged.set(operation.operationId, operation);
  return [...merged.values()];
}

export function mergeDailyFile(left: ReadableTrackerDayBackup, right: ReadableTrackerDayBackup): ReadableTrackerDayBackup {
  const a = "customNawafil" in left ? left : { ...left, customNawafil: [] };
  const b = "customNawafil" in right ? right : { ...right, customNawafil: [] };
  const marks = { ...a.marks };
  for (const [id, mark] of Object.entries(b.marks || {})) if (!marks[id] || mark.changedAt > marks[id].changedAt) marks[id] = mark;
  const log = { ...a.log };
  for (const [id, value] of Object.entries(b.log || {})) if (marks[id] ? marks[id].completed === value : log[id] === undefined) log[id] = value;
  const custom = new Map([...(a.customNawafil || []), ...(b.customNawafil || [])].map((item) => [item.id, item]));
  return { version: 3, date: a.date, log, marks, customNawafil: [...custom.values()] };
}

export function mergeSummary(left: TrackerSummary, right: TrackerSummary): TrackerSummary {
  const dailyFileIds = { ...(left.dailyFileIds || {}), ...(right.dailyFileIds || {}) };
  const qazaFileIds = { ...(left.qazaFileIds || {}), ...(right.qazaFileIds || {}) };
  const qazaYearFileIds = { ...(left.qazaFileIds?.years || {}), ...(right.qazaFileIds?.years || {}) };
  qazaFileIds.years = qazaYearFileIds;
  const leftTime = Date.parse(left.updatedAt || "") || 0; const rightTime = Date.parse(right.updatedAt || "") || 0;
  const base = rightTime >= leftTime ? right : left;
  const qazaTotals = right.qazaTotals ? (rightTime >= leftTime ? right.qazaTotals : left.qazaTotals || right.qazaTotals) : left.qazaTotals || { added: 0, completed: 0, outstanding: 0 };
  return { ...base, dailyFileIds, qazaFileIds, qazaTotals };
}
