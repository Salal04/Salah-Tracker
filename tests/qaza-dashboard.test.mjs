import assert from "node:assert/strict";
import { test } from "node:test";
import statsModule from "../node_modules/.cache/salah-tracker-tests/qaza/stats.js";
import completeModule from "../node_modules/.cache/salah-tracker-tests/qaza/complete.js";
import repositoryModule from "../node_modules/.cache/salah-tracker-tests/qaza/repository.js";
import dashboardModule from "../node_modules/.cache/salah-tracker-tests/qaza/dashboard.js";

const { buildStatistics, applyOperation } = statsModule;
const { completeQaza, adjustQaza } = completeModule;
const { createInMemoryQazaRepository } = repositoryModule;
const { getSuggestedQaza } = dashboardModule;
const record = (id, missedDate, status = "outstanding", year = missedDate ? Number(missedDate.slice(0, 4)) : null) => ({ id, prayer: "fajr", missedDate, detectedAt: "2026-11-10T12:00:00.000Z", source: "manual", status, year, ...(status === "completed" ? { offeredAt: "2027-01-02T10:00:00.000Z", completedAt: "2027-01-02T10:00:00.000Z", affirmation: "none" } : {}) });

test("suggestions sort oldest dated first, put undated last, and omit completed records", () => {
  const result = getSuggestedQaza([record("new", "2026-04-01"), record("unknown", null), record("old", "2020-01-01"), record("done", "2010-01-01", "completed")]);
  assert.deepEqual(result.map((r) => r.id), ["old", "new", "unknown"]);
});

test("an empty repository reports zero completion percent", () => {
  assert.equal(buildStatistics([]).completionPercentage, 0);
});

test("completion updates the original record, statistics by completion year, and is idempotent", async () => {
  const repository = createInMemoryQazaRepository(); const original = record("q-2026", "2026-06-01");
  await repository.putRecords([original]); await repository.putStatistics(buildStatistics([[original]]));
  const updated = await completeQaza(repository, original.id, "none", new Date("2027-01-02T10:00:00.000Z"));
  const again = await completeQaza(repository, original.id, "none", new Date("2027-01-02T10:00:00.000Z"));
  assert.equal(updated.year, 2026); assert.equal(again.status, "completed");
  assert.equal((await repository.listPendingOperations()).length, 1);
  const stats = await repository.getStatistics(); assert.equal(stats.byYear["2027"].completed, 1); assert.equal(stats.byYear["2026"].outstanding, 0);
});

test("incremental stats separate completion year from original year", () => {
  const beforeRecord = record("q", "2026-01-01"); const before = buildStatistics([[beforeRecord]]);
  const afterRecord = record("q", "2026-01-01", "completed");
  const after = applyOperation(before, { operationId: "complete-q", type: "COMPLETE_QAZA", recordId: "q", year: 2026, createdAt: afterRecord.completedAt, status: "pending", previousRecord: beforeRecord, record: afterRecord });
  assert.equal(after.byYear["2027"].completed, 1); assert.equal(after.byYear["2026"].outstanding, 0);
});

test("adjustment voids accidental entries and preserves reversed completion history", async () => {
  const repository = createInMemoryQazaRepository(); const outstanding = record("mistake", "2026-02-01");
  await repository.putRecords([outstanding]); await repository.putStatistics(buildStatistics([[outstanding]]));
  await adjustQaza(repository, "mistake", "entered_by_mistake", new Date("2026-11-10T12:00:00.000Z"));
  assert.equal((await repository.getById("mistake")).status, "voided"); assert.equal((await repository.getStatistics()).totalAdded, 0);
  const completed = { ...record("reversal", "2026-03-01", "completed"), completionHistory: [{ offeredAt: "2026-11-01T00:00:00.000Z", completedAt: "2026-11-01T00:00:00.000Z", affirmation: "oath" }] };
  await repository.putRecords([completed]); await repository.putStatistics(buildStatistics([[completed]]));
  const reverted = await adjustQaza(repository, "reversal", "completed_by_mistake", new Date("2026-11-10T12:00:00.000Z"));
  assert.equal(reverted.status, "outstanding"); assert.equal(reverted.completionHistory[0].reversedAt, "2026-11-10T12:00:00.000Z");
});
