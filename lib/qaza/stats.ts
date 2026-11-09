import { QAZA_PRAYERS, type QazaOperation, type QazaRecord, type QazaStatistics } from "./types";
import type { QazaRepository } from "./repository";

const empty = (): QazaStatistics => ({ totalRecords: 0, totalAdded: 0, totalCompleted: 0, totalOutstanding: 0, completionPercentage: 0,
  byPrayer: Object.fromEntries(QAZA_PRAYERS.map((p) => [p, { added: 0, completed: 0, outstanding: 0 }])) as QazaStatistics["byPrayer"],
  byYear: {}, bySource: { auto: 0, manual: 0 }, completedByAffirmation: { oath: 0, none: 0 } });

const addRecord = (stats: QazaStatistics, record: QazaRecord, direction: 1 | -1) => {
  if (record.status === "voided") return;
  stats.totalRecords += direction;
  if (record.status === "pending_confirmation" || record.status === "offered") return;
  const prayer = stats.byPrayer[record.prayer];
  prayer.added += direction; stats.totalAdded += direction; stats.bySource[record.source] += direction;
  const origin = record.year === null ? null : String(record.year);
  if (origin) { stats.byYear[origin] ||= { originated: 0, completed: 0, outstanding: 0 }; stats.byYear[origin].originated += direction; }
  if (record.status === "completed") {
    prayer.completed += direction; stats.totalCompleted += direction;
    const completedYear = record.completedAt?.slice(0, 4);
    if (completedYear) { stats.byYear[completedYear] ||= { originated: 0, completed: 0, outstanding: 0 }; stats.byYear[completedYear].completed += direction; }
    if (record.affirmation) stats.completedByAffirmation[record.affirmation] += direction;
  } else {
    prayer.outstanding += direction; stats.totalOutstanding += direction;
    if (origin) stats.byYear[origin].outstanding += direction;
  }
  for (const [year, row] of Object.entries(stats.byYear)) if (row.originated === 0 && row.completed === 0 && row.outstanding === 0) delete stats.byYear[year];
};

const finish = (stats: QazaStatistics): QazaStatistics => {
  stats.completionPercentage = stats.totalAdded === 0 ? 0 : stats.totalCompleted / stats.totalAdded * 100;
  return stats;
};

export function buildStatistics(recordsByYear: Iterable<QazaRecord[]> | Record<string, QazaRecord[]>): QazaStatistics {
  const stats = empty();
  const groups = Symbol.iterator in Object(recordsByYear) ? recordsByYear as Iterable<QazaRecord[]> : Object.values(recordsByYear as Record<string, QazaRecord[]>);
  for (const records of groups) for (const record of records) addRecord(stats, record, 1);
  return finish(stats);
}

export function applyOperation(stats: QazaStatistics, operation: QazaOperation): QazaStatistics {
  const next = structuredClone(stats);
  if (!operation.record) return next;
  if (operation.previousRecord) addRecord(next, operation.previousRecord, -1);
  addRecord(next, operation.record, 1);
  return finish(next);
}

export async function reconcile(repository: QazaRepository): Promise<QazaStatistics> {
  const records = await repository.listAllRecords();
  const stats = buildStatistics([records]);
  await repository.putStatistics(stats);
  return stats;
}
