import type { QazaAffirmation, QazaOperation, QazaRecord } from "./types";
import type { QazaRepository } from "./repository";
import { applyOperation, reconcile } from "./stats";

export async function completeQaza(repository: QazaRepository, recordId: string, affirmation: QazaAffirmation, now = new Date()): Promise<QazaRecord | null> {
  const record = await repository.getById(recordId);
  if (!record) return null;
  if (record.status === "completed") { await reconcile(repository); return record; }
  if (record.status !== "outstanding") return record;
  const at = now.toISOString();
  const operationId = `complete-${record.id}-${(record.completionHistory?.length || 0) + (record.adjustments?.length || 0) + 1}`;
  const updated: QazaRecord = { ...record, status: "completed", offeredAt: at, completedAt: at, affirmation,
    completionHistory: [...(record.completionHistory || []), { offeredAt: at, completedAt: at, affirmation }] };
  const operation: QazaOperation = { operationId, type: "COMPLETE_QAZA", recordId, year: record.year, createdAt: at, status: "pending", previousRecord: record, record: updated };
  const stats = (await repository.getStatistics()) || await reconcile(repository);
  try { await repository.addOperation(operation); } catch (error) {
    const savedOperation = (await repository.listPendingOperations()).some((candidate) => candidate.operationId === operationId);
    if (!savedOperation) {
      if ((await repository.getById(recordId))?.status === "completed") return repository.getById(recordId);
      throw error;
    }
  }
  await repository.putRecords([updated]);
  await repository.putStatistics(applyOperation(stats, operation));
  return updated;
}

export async function adjustQaza(repository: QazaRepository, recordId: string, reason: "entered_by_mistake" | "completed_by_mistake", now = new Date()): Promise<QazaRecord | null> {
  const record = await repository.getById(recordId);
  if (!record || (reason === "entered_by_mistake" ? record.status !== "outstanding" : record.status !== "completed")) return record;
  const at = now.toISOString(); const operationId = `adjust-${record.id}-${reason}-${(record.adjustments?.length || 0) + 1}`;
  const history = [...(record.completionHistory || [])];
  if (reason === "completed_by_mistake") {
    if (!history.length && record.offeredAt && record.completedAt && record.affirmation) history.push({ offeredAt: record.offeredAt, completedAt: record.completedAt, affirmation: record.affirmation });
    if (history.length) history[history.length - 1] = { ...history[history.length - 1], reversedAt: at };
  }
  const updated: QazaRecord = { ...record, status: reason === "entered_by_mistake" ? "voided" : "outstanding", completionHistory: history,
    adjustments: [...(record.adjustments || []), { reason, createdAt: at, operationId }],
    ...(reason === "completed_by_mistake" ? { offeredAt: undefined, completedAt: undefined, affirmation: undefined } : {}) };
  const operation: QazaOperation = { operationId, type: "ADJUST", adjustmentReason: reason, recordId, year: record.year, createdAt: at, status: "pending", previousRecord: record, record: updated };
  const stats = (await repository.getStatistics()) || await reconcile(repository);
  await repository.addOperation(operation); await repository.putRecords([updated]);
  await repository.putStatistics(applyOperation(stats, operation));
  return updated;
}
