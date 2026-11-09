import assert from "node:assert/strict";
import { test } from "node:test";
import qazaValidators from "../node_modules/.cache/salah-tracker-tests/qaza/validate.js";

const { isQazaRecord, isQazaOperation, isQazaStatistics } = qazaValidators;
const record = {
  id: "qaza-1",
  prayer: "fajr",
  missedDate: "2026-11-09",
  detectedAt: "2026-11-10T01:00:00.000Z",
  source: "auto",
  status: "outstanding",
  year: 2026,
};

test("validates a dated outstanding Qaza record", () => {
  assert.equal(isQazaRecord(record), true);
});

test("validates an undated manual backlog and its import ID", () => {
  assert.equal(isQazaRecord({ ...record, missedDate: null, source: "manual", importId: "import-123" }), true);
  assert.equal(isQazaRecord({ ...record, missedDate: null, year: null, source: "manual", importId: "import-unknown-year" }), true);
});

test("validates an offered record with its resolution timestamp", () => {
  assert.equal(isQazaRecord({ ...record, status: "offered", offeredAt: "2026-11-10T01:00:00.000Z" }), true);
  assert.equal(isQazaRecord({ ...record, status: "offered" }), false);
});

test("rejects invalid prayer, impossible date, mismatched year, and incomplete completion", () => {
  assert.equal(isQazaRecord({ ...record, prayer: "witr" }), false);
  assert.equal(isQazaRecord({ ...record, missedDate: "2026-02-30" }), false);
  assert.equal(isQazaRecord({ ...record, year: 2025 }), false);
  assert.equal(isQazaRecord({ ...record, status: "completed" }), false);
});

test("validates Qaza sync operation shape and rejects unknown statuses", () => {
  const operation = {
    operationId: "op-qaza-001",
    type: "COMPLETE_QAZA",
    recordId: "qaza-1",
    year: 2026,
    createdAt: "2026-11-10T01:00:00.000Z",
    status: "pending",
  };
  assert.equal(isQazaOperation(operation), true);
  assert.equal(isQazaOperation({ ...operation, status: "done" }), false);
  assert.equal(isQazaOperation({ ...operation, year: 0 }), false);
});

test("validates overall, prayer-wise, year-wise, source, and affirmation statistics", () => {
  const statistics = {
    totalRecords: 3,
    totalAdded: 3,
    totalCompleted: 1,
    totalOutstanding: 2,
    completionPercentage: 33.333,
    byPrayer: Object.fromEntries(["fajr", "dhuhr", "asr", "maghrib", "isha"].map((prayer) => [prayer, { added: 0, completed: 0, outstanding: 0 }])),
    byYear: { "2026": { originated: 3, completed: 1, outstanding: 2 } },
    bySource: { auto: 2, manual: 1 },
    completedByAffirmation: { oath: 1, none: 0 },
  };
  assert.equal(isQazaStatistics(statistics), true);
  assert.equal(isQazaStatistics({ ...statistics, completionPercentage: 101 }), false);
  assert.equal(isQazaStatistics({ ...statistics, totalOutstanding: -1 }), false);
});
