import type { QazaRepository } from "../qaza/repository";
import type { QazaOperation, QazaStatistics } from "../qaza/types";
import type { SyncQueueWorker } from "./queue";

export interface RecoveryWorker extends SyncQueueWorker {
  reconcileStatistics(force?: boolean): Promise<QazaStatistics>;
  repairStatistics(statistics: QazaStatistics): Promise<void>;
}

export async function recoverQazaSync(repository: QazaRepository, worker: RecoveryWorker): Promise<{ recovered: string[]; statisticsRebuilt: boolean }> {
  const recovered: string[] = [];
  for (const operation of await repository.listPartialOperations()) {
    let state: Partial<QazaOperation> = operation;
    if (!state.yearWritten) {
      await worker.writeYear(operation.year, [operation]); state = { ...state, yearWritten: true };
      await repository.updateOperation(operation.operationId, { status: "partial", yearWritten: true });
    }
    if (!state.statisticsWritten) {
      await worker.writeStatistics(operation.year, [operation]); state = { ...state, statisticsWritten: true };
      await repository.updateOperation(operation.operationId, { status: "partial", yearWritten: true, statisticsWritten: true });
    }
    await repository.updateOperation(operation.operationId, { status: "synced", yearWritten: true, statisticsWritten: true });
    recovered.push(operation.operationId);
  }
  const remoteProjection = await worker.reconcileStatistics();
  const localProjection = await repository.getStatistics();
  const rebuilt = !localProjection || JSON.stringify(localProjection) !== JSON.stringify(remoteProjection);
  await repository.putStatistics(remoteProjection);
  await worker.repairStatistics(remoteProjection);
  return { recovered, statisticsRebuilt: rebuilt };
}

export async function repairQazaData(repository: QazaRepository, worker: RecoveryWorker): Promise<void> {
  const projection = await worker.reconcileStatistics(true);
  await repository.putStatistics(projection);
  await worker.repairStatistics(projection);
}
