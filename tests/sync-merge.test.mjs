import assert from "node:assert/strict";
import { test } from "node:test";
import mergeModule from "../node_modules/.cache/salah-tracker-tests/sync/merge.js";

const { mergeQazaYear, mergeQazaOperations, mergeDailyFile, mergeSummary } = mergeModule;
const base = (status, completedAt) => ({ id: "same", prayer: "fajr", missedDate: "2026-01-01", detectedAt: "2026-01-02T00:00:00.000Z", source: "manual", status, year: 2026, ...(completedAt ? { completedAt, offeredAt: completedAt, affirmation: "none" } : {}) });

test("yearly Qaza merge gives completed records precedence over outstanding edits", () => {
  const merged = mergeQazaYear([base("outstanding")], [base("completed", "2026-02-01T00:00:00.000Z")]);
  assert.equal(merged.length, 1); assert.equal(merged[0].status, "completed");
});

test("an explicit adjustment with a newer audit entry can reverse an earlier completion", () => {
  const completed = base("completed", "2026-02-01T00:00:00.000Z");
  const adjusted = { ...base("outstanding"), adjustments: [{ reason: "completed_by_mistake", createdAt: "2026-02-02T00:00:00.000Z", operationId: "adjust-1" }] };
  assert.equal(mergeQazaYear([completed], [adjusted])[0].status, "outstanding");
});

test("operation merge deduplicates by operationId", () => {
  assert.equal(mergeQazaOperations([{ operationId: "op", recordId: "a" }], [{ operationId: "op", recordId: "b" }, { operationId: "op2" }]).length, 2);
});

test("daily file merge selects the latest changed mark from two devices", () => {
  const a = { version: 3, date: "2026-01-01", log: { fajr: true }, marks: { fajr: { changedAt: "2026-01-01T01:00:00Z", completed: true } }, customNawafil: [] };
  const b = { ...a, log: { fajr: false }, marks: { fajr: { changedAt: "2026-01-01T02:00:00Z", completed: false } } };
  const merged = mergeDailyFile(a, b); assert.equal(merged.marks.fajr.completed, false); assert.equal(merged.log.fajr, false);
});

test("summary merge combines indexes from both devices while preserving aggregate totals", () => {
  const a = { version: 1, startDate: "2026-01-01", analysis: {}, dailyFileIds: { "2026-01-01": "a" }, qazaTotals: { added: 3, completed: 1, outstanding: 2 } };
  const b = { ...a, updatedAt: "2026-02-01T00:00:00Z", dailyFileIds: { "2026-01-02": "b" }, qazaTotals: { added: 4, completed: 2, outstanding: 2 } };
  const merged = mergeSummary(a, b); assert.deepEqual(merged.dailyFileIds, { "2026-01-01": "a", "2026-01-02": "b" }); assert.equal(merged.qazaTotals.added, 4);
});
