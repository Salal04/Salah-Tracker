import assert from "node:assert/strict";
import { test } from "node:test";
import queueModule from "../node_modules/.cache/salah-tracker-tests/sync/queue.js";
import repositoryModule from "../node_modules/.cache/salah-tracker-tests/qaza/repository.js";
import quotaModule from "../node_modules/.cache/salah-tracker-tests/sync/quota.js";

const { enqueueOperation, processSyncQueue } = queueModule;
const { createInMemoryQazaRepository } = repositoryModule;
const { createSyncQuotaState } = quotaModule;
const operation = (id, extra = {}) => ({ operationId: id, type: "COMPLETE_QAZA", recordId: id, year: 2026, createdAt: "2026-01-01T00:00:00.000Z", status: "pending", ...extra });

test("queue deduplicates operation IDs and retries with exponential delay after a fake Drive failure", async () => {
  const repository = createInMemoryQazaRepository(); assert.equal(await enqueueOperation(repository, operation("one")), true); assert.equal(await enqueueOperation(repository, operation("one")), false);
  const calls = { year: 0, stats: 0 }; let failStats = true;
  const worker = { async writeYear() { calls.year++; }, async writeStatistics() { calls.stats++; if (failStats) { failStats = false; throw new Error("Drive offline"); } } };
  let now = new Date("2026-01-01T00:00:00.000Z");
  const options = { now: () => now, random: () => 0.5, baseDelayMs: 1000, maxDelayMs: 10000 };
  let result = await processSyncQueue(repository, worker, options); assert.deepEqual(result.waiting, ["one"]);
  let saved = await repository.listPartialOperations(); assert.equal(saved[0].yearWritten, true); assert.equal(saved[0].attemptCount, 1); assert.equal(Date.parse(saved[0].nextAttemptAt), now.getTime() + 1000);
  now = new Date(now.getTime() + 999); result = await processSyncQueue(repository, worker, options); assert.equal(result.synced.length, 0);
  now = new Date(now.getTime() + 1); result = await processSyncQueue(repository, worker, options);
  assert.deepEqual(result.synced, ["one"]); assert.equal(calls.year, 1); assert.equal(calls.stats, 2);
});

test("queue pauses while offline and consumes no Drive writes", async () => {
  const repository = createInMemoryQazaRepository(); await enqueueOperation(repository, operation("offline")); let calls = 0;
  const result = await processSyncQueue(repository, { async writeYear() { calls++; }, async writeStatistics() { calls++; } }, { isOnline: () => false });
  assert.deepEqual(result.waiting, ["offline"]); assert.equal(calls, 0);
});

test("daily operations cannot exceed the five fard plus one nafl quota", async () => {
  const repository = createInMemoryQazaRepository(); const date = "2026-01-01";
  const fard = ["fajr", "dhuhr", "asr", "maghrib", "isha"].map((prayerId) => ({ kind: "fard", prayerId, windowStart: "2025-12-31T00:00:00.000Z", windowEnd: "2026-01-02T00:00:00.000Z" }));
  for (const [i, syncSlot] of [...fard, { kind: "nafl" }].entries()) await enqueueOperation(repository, operation(`slot-${i}`, { year: 2026, syncSlot }));
  let writes = 0; const worker = { async writeYear() { writes++; }, async writeStatistics() { writes++; } };
  const result = await processSyncQueue(repository, worker, { now: () => new Date(`${date}T12:00:00`), initialQuota: createSyncQuotaState(date) });
  assert.equal(result.synced.length, 6); assert.equal(writes, 2); assert.equal(result.quota.fardUsed.length + result.quota.naflUsed, 6);
});
