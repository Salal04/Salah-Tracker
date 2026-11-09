import type { QazaOperation } from "../qaza/types";
import type { QazaRepository } from "../qaza/repository";
import { claimSyncQuotaSlots, createSyncQuotaState, type SyncQuotaState, type SyncSlot } from "./quota";

export interface SyncQueueWorker {
  writeYear(year: number | null, operations: QazaOperation[]): Promise<void>;
  writeStatistics(year: number | null, operations: QazaOperation[]): Promise<void>;
}
export type QueueOptions = {
  now?: () => Date;
  random?: () => number;
  isOnline?: () => boolean;
  initialQuota?: SyncQuotaState;
  saveQuota?: (state: SyncQuotaState) => Promise<void>;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onWaiting?: (operation: QazaOperation, message: string) => void;
};
export type QueueResult = { synced: string[]; waiting: string[]; quota?: SyncQuotaState };

export async function enqueueOperation(repository: QazaRepository, operation: QazaOperation): Promise<boolean> {
  if (await repository.operationExists(operation.operationId)) return false;
  if ((await repository.listPendingOperations()).some((saved) => saved.operationId === operation.operationId)
    || (await repository.listPartialOperations()).some((saved) => saved.operationId === operation.operationId)) return false;
  try { await repository.addOperation({ ...operation, status: "pending", attemptCount: operation.attemptCount || 0 }); return true; }
  catch (error) {
    if ((await repository.listPendingOperations()).some((saved) => saved.operationId === operation.operationId)) return false;
    throw error;
  }
}

const targetKey = (year: number | null) => year === null ? "undated" : String(year);
const retryDelay = (attempt: number, random: () => number, base: number, cap: number) => Math.min(cap, base * (2 ** Math.max(0, attempt - 1)) * (0.5 + random()));

export async function processSyncQueue(repository: QazaRepository, worker: SyncQueueWorker, options: QueueOptions = {}): Promise<QueueResult> {
  const now = options.now || (() => new Date()); const random = options.random || Math.random;
  let quota = options.initialQuota;
  const synced: string[] = []; const waiting: string[] = [];
  if (options.isOnline && !options.isOnline()) {
    const operations = [...await repository.listPendingOperations(), ...await repository.listPartialOperations()];
    for (const operation of operations) { waiting.push(operation.operationId); options.onWaiting?.(operation, "Waiting for a network connection"); }
    return { synced, waiting, ...(quota ? { quota } : {}) };
  }
  const currentTime = now();
  const ready = [...await repository.listPendingOperations(), ...await repository.listPartialOperations()]
    .filter((op) => !op.nextAttemptAt || Date.parse(op.nextAttemptAt) <= currentTime.getTime())
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const batches = new Map<string, QazaOperation[]>();
  for (const operation of ready) batches.set(targetKey(operation.year), [...(batches.get(targetKey(operation.year)) || []), operation]);
  for (const operations of batches.values()) {
    const slots = operations.map((op) => op.syncSlot).filter((slot): slot is SyncSlot => !!slot);
    if (slots.length) {
      quota ||= createSyncQuotaState(`${currentTime.getFullYear()}-${String(currentTime.getMonth()+1).padStart(2,"0")}-${String(currentTime.getDate()).padStart(2,"0")}`);
      const claim = claimSyncQuotaSlots(quota, slots, currentTime);
      if (!claim.allowed) {
        const retryAt = new Date(currentTime); retryAt.setHours(24, 0, 0, 5);
        for (const operation of operations) {
          const updated = { ...operation, status: "pending" as const, nextAttemptAt: retryAt.toISOString() };
          await repository.updateOperation(operation.operationId, updated); waiting.push(operation.operationId); options.onWaiting?.(updated, "Waiting for the next available Drive sync slot");
        }
        continue;
      }
      quota = claim.state; await options.saveQuota?.(quota);
    }
    const year = operations[0].year;
    for (const operation of operations) await repository.updateOperation(operation.operationId, { status: "partial", yearWritten: operation.yearWritten || false, statisticsWritten: operation.statisticsWritten || false });
    let yearWritten = operations.every((op) => op.yearWritten);
    let statisticsWritten = operations.every((op) => op.statisticsWritten);
    try {
      if (!yearWritten) {
        await worker.writeYear(year, operations);
        yearWritten = true;
        for (const operation of operations) await repository.updateOperation(operation.operationId, { status: "partial", yearWritten: true });
      }
      if (!statisticsWritten) {
        await worker.writeStatistics(year, operations);
        statisticsWritten = true;
        for (const operation of operations) await repository.updateOperation(operation.operationId, { status: "partial", yearWritten: true, statisticsWritten: true });
      }
      for (const operation of operations) { await repository.updateOperation(operation.operationId, { status: "synced", yearWritten: true, statisticsWritten: true, nextAttemptAt: undefined }); synced.push(operation.operationId); }
    } catch {
      for (const operation of operations) {
        const attemptCount = (operation.attemptCount || 0) + 1;
        const delay = retryDelay(attemptCount, random, options.baseDelayMs || 1000, options.maxDelayMs || 3_600_000);
        const updated = { ...operation, yearWritten, statisticsWritten, attemptCount, nextAttemptAt: new Date(currentTime.getTime() + delay).toISOString(), status: yearWritten ? "partial" as const : "pending" as const };
        await repository.updateOperation(operation.operationId, updated);
        waiting.push(operation.operationId); options.onWaiting?.(updated, "Waiting to sync; will retry automatically");
      }
    }
  }
  return { synced, waiting, ...(quota ? { quota } : {}) };
}

export function resumeQueueOnOnline(run: () => void, target?: Pick<Window, "addEventListener" | "removeEventListener">): () => void {
  const surface = target || (typeof window !== "undefined" ? window : undefined); if (!surface) return () => undefined;
  const resume = () => run(); surface.addEventListener("online", resume); return () => surface.removeEventListener("online", resume);
}
