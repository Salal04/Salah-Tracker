import assert from "node:assert/strict";
import { test } from "node:test";
import qazaReviewModule from "../node_modules/.cache/salah-tracker-tests/qaza/review.js";
import qazaRepositoryModule from "../node_modules/.cache/salah-tracker-tests/qaza/repository.js";

const { answerQazaReview } = qazaReviewModule;
const { createInMemoryQazaRepository } = qazaRepositoryModule;
const pending = (id) => ({
  id,
  prayer: "fajr",
  missedDate: "2026-11-09",
  detectedAt: "2026-11-10T01:00:00.000Z",
  source: "auto",
  status: "pending_confirmation",
  year: 2026,
});
const now = new Date("2026-11-10T06:00:00.000Z");

test("Yes resolves a pending record as offered and writes an operation", async () => {
  const repository = createInMemoryQazaRepository();
  await repository.putRecords([pending("qaza-yes")]);
  const reviewed = await answerQazaReview(repository, "qaza-yes", "yes", now);
  assert.equal(reviewed.status, "offered");
  assert.equal(reviewed.offeredAt, now.toISOString());
  assert.equal(await repository.getById("qaza-yes").then((record) => record.status), "offered");
  assert.equal((await repository.listPendingOperations())[0].type, "CONFIRM_OFFERED");
  assert.deepEqual(await repository.listOutstanding(), []);
});

test("No converts a pending record to outstanding and writes an operation", async () => {
  const repository = createInMemoryQazaRepository();
  await repository.putRecords([pending("qaza-no")]);
  const reviewed = await answerQazaReview(repository, "qaza-no", "no", now);
  assert.equal(reviewed.status, "outstanding");
  assert.equal((await repository.listOutstanding()).map((record) => record.id).join(), "qaza-no");
  assert.equal((await repository.listPendingOperations())[0].type, "CONFIRM_MISSED");
});

test("Not sure leaves the record pending and writes a defer operation", async () => {
  const repository = createInMemoryQazaRepository();
  await repository.putRecords([pending("qaza-unsure")]);
  const reviewed = await answerQazaReview(repository, "qaza-unsure", "not_sure", now);
  assert.equal(reviewed.status, "pending_confirmation");
  assert.equal((await repository.listPendingConfirmation()).length, 1);
  assert.equal((await repository.listPendingOperations())[0].type, "DEFER_CONFIRMATION");
});

test("review rejects records that are no longer awaiting confirmation", async () => {
  const repository = createInMemoryQazaRepository();
  await repository.putRecords([{ ...pending("already-reviewed"), status: "offered", offeredAt: now.toISOString() }]);
  await assert.rejects(answerQazaReview(repository, "already-reviewed", "no", now), /no longer awaiting confirmation/);
  assert.deepEqual(await repository.listPendingOperations(), []);
});
