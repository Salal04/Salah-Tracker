import assert from "node:assert/strict";
import { test } from "node:test";
import qazaRepositoryModule from "../node_modules/.cache/salah-tracker-tests/qaza/repository.js";

const { createInMemoryQazaRepository } = qazaRepositoryModule;
const record = (id, year, status = "outstanding") => ({
  id,
  prayer: "fajr",
  missedDate: `${year}-01-04`,
  detectedAt: `${year}-01-05T08:30:00.000Z`,
  source: "auto",
  status,
  year,
  ...(status === "completed" ? { completedAt: `${year}-01-06T08:30:00.000Z` } : {}),
});
const operation = (operationId, recordId, status = "pending") => ({
  operationId,
  type: "COMPLETE_QAZA",
  recordId,
  year: 2026,
  createdAt: "2026-01-06T08:30:00.000Z",
  status,
});

test("in-memory repository stores, replaces, and retrieves records by year and ID", async () => {
  const repository = createInMemoryQazaRepository();
  await repository.putRecords([record("a", 2026), record("b", 2027)]);
  assert.deepEqual((await repository.getYear(2026)).map(({ id }) => id), ["a"]);
  assert.equal((await repository.getById("b"))?.year, 2027);
  await repository.putRecords([{ ...record("a", 2026), status: "completed", completedAt: "2026-01-06T08:30:00.000Z" }]);
  assert.equal((await repository.getById("a"))?.status, "completed");
  assert.deepEqual(await repository.listOutstanding(), [{ ...record("b", 2027) }]);
});

test("in-memory repository queues only pending operations and rejects duplicate operation IDs", async () => {
  const repository = createInMemoryQazaRepository();
  await repository.addOperation(operation("op-1", "qaza-1"));
  await repository.addOperation(operation("op-2", "qaza-2", "synced"));
  assert.deepEqual(await repository.listPendingOperations(), [operation("op-1", "qaza-1")]);
  await assert.rejects(repository.addOperation(operation("op-1", "qaza-1")), /already exists/);
});

test("in-memory repository saves statistics, processed dates, and metadata defensively", async () => {
  const repository = createInMemoryQazaRepository();
  const stats = {
    totalRecords: 0,
    totalAdded: 0,
    totalCompleted: 0,
    totalOutstanding: 0,
    completionPercentage: 0,
    byPrayer: Object.fromEntries(["fajr", "dhuhr", "asr", "maghrib", "isha"].map((prayer) => [prayer, { added: 0, completed: 0, outstanding: 0 }])),
    byYear: {},
    bySource: { auto: 0, manual: 0 },
    completedByAffirmation: { oath: 0, none: 0 },
  };
  await repository.putStatistics(stats);
  assert.deepEqual(await repository.getStatistics(), stats);
  await repository.markDateProcessed("2026-11-10");
  assert.equal(await repository.isDateProcessed("2026-11-10"), true);
  assert.equal(await repository.isDateProcessed("2026-11-09"), false);
  await assert.rejects(repository.markDateProcessed("2026-02-30"), /valid YYYY-MM-DD/);
  const metadata = { schemaVersion: 1 };
  await repository.setMeta("sample", metadata);
  metadata.version = 2;
  assert.deepEqual(await repository.getMeta("sample"), { schemaVersion: 1 });
});
