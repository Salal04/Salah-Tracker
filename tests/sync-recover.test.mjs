import assert from "node:assert/strict";
import { test } from "node:test";
import recoverModule from "../node_modules/.cache/salah-tracker-tests/sync/recover.js";
import repositoryModule from "../node_modules/.cache/salah-tracker-tests/qaza/repository.js";
import statsModule from "../node_modules/.cache/salah-tracker-tests/qaza/stats.js";

const { recoverQazaSync } = recoverModule; const { createInMemoryQazaRepository } = repositoryModule; const { buildStatistics } = statsModule;
const op = (id, flags) => ({ operationId: id, type: "COMPLETE_QAZA", recordId: id, year: 2026, createdAt: "2026-01-01T00:00:00Z", status: "partial", ...flags });

test("recovers a crash after yearly record write but before statistics write", async () => {
  const repository = createInMemoryQazaRepository(); await repository.addOperation(op("year-first", { yearWritten: true, statisticsWritten: false }));
  const calls = []; const stats = buildStatistics([]); const worker = { async writeYear() { calls.push("year"); }, async writeStatistics() { calls.push("statistics"); }, async reconcileStatistics() { return stats; }, async repairStatistics() { calls.push("repair"); } };
  const result = await recoverQazaSync(repository, worker); assert.deepEqual(calls, ["statistics", "repair"]); assert.deepEqual(result.recovered, ["year-first"]);
  assert.equal((await repository.listPendingOperations()).length, 0);
});

test("recovers a crash after statistics write but before yearly record write", async () => {
  const repository = createInMemoryQazaRepository(); await repository.addOperation(op("stats-first", { yearWritten: false, statisticsWritten: true }));
  const calls = []; const stats = buildStatistics([]); const worker = { async writeYear() { calls.push("year"); }, async writeStatistics() { calls.push("statistics"); }, async reconcileStatistics() { return stats; }, async repairStatistics() { calls.push("repair"); } };
  await recoverQazaSync(repository, worker); assert.deepEqual(calls, ["year", "repair"]);
});

test("rebuilds a disagreeing projection from repository/yearly source records and repairs Drive", async () => {
  const repository = createInMemoryQazaRepository(); const local = buildStatistics([]); const actual = { id: "source", prayer: "fajr", missedDate: "2026-01-01", detectedAt: "2026-01-02T00:00:00Z", source: "manual", status: "outstanding", year: 2026 };
  await repository.putRecords([actual]); await repository.putStatistics(local); let repaired = null;
  const sourceStats = buildStatistics([[actual]]); const worker = { async writeYear() {}, async writeStatistics() {}, async reconcileStatistics() { return sourceStats; }, async repairStatistics(stats) { repaired = stats; } };
  const result = await recoverQazaSync(repository, worker); assert.equal(result.statisticsRebuilt, true); assert.equal(repaired.totalOutstanding, 1); assert.equal((await repository.getStatistics()).totalOutstanding, 1);
});
