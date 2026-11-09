import assert from "node:assert/strict";
import { test } from "node:test";
import manualQazaModule from "../node_modules/.cache/salah-tracker-tests/qaza/manual.js";

const { generateManualQazaRecords } = manualQazaModule;
const now = new Date("2026-11-10T12:00:00.000Z");

test("bulk generation creates individual outstanding manual records with a shared import ID", () => {
  let sequence = 0;
  const records = generateManualQazaRecords(
    { prayer: "fajr", quantity: 20, missedDate: null },
    { now, importId: "import-shared", createId: () => `qaza-${++sequence}` },
  );
  assert.equal(records.length, 20);
  assert.equal(new Set(records.map((record) => record.id)).size, 20);
  assert.ok(records.every((record) => record.prayer === "fajr"));
  assert.ok(records.every((record) => record.status === "outstanding" && record.source === "manual"));
  assert.ok(records.every((record) => record.missedDate === null && record.year === null));
  assert.ok(records.every((record) => record.importId === "import-shared" && record.detectedAt === now.toISOString()));
});

test("undated backlog can carry a supplied original year without inventing a missed date", () => {
  const [record] = generateManualQazaRecords(
    { prayer: "isha", quantity: 1, missedDate: null, year: 2018 },
    { now, importId: "known-year", createId: () => "record-1" },
  );
  assert.equal(record.missedDate, null);
  assert.equal(record.year, 2018);
});

test("an exact missed date sets the original year from that date", () => {
  const [record] = generateManualQazaRecords(
    { prayer: "dhuhr", quantity: 1, missedDate: "2019-04-03" },
    { now, importId: "exact-date", createId: () => "record-1" },
  );
  assert.equal(record.missedDate, "2019-04-03");
  assert.equal(record.year, 2019);
});

test("validates quantity, prayer, date, and year inputs", () => {
  for (const quantity of [0, -1, 5001, 1.5]) {
    assert.throws(() => generateManualQazaRecords({ prayer: "fajr", quantity }, { createId: () => "id" }), /Quantity/);
  }
  assert.throws(() => generateManualQazaRecords({ prayer: "witr", quantity: 1 }, { createId: () => "id" }), /Fard prayers/);
  assert.throws(() => generateManualQazaRecords({ prayer: "fajr", quantity: 1, missedDate: "2026-02-30" }, { createId: () => "id" }), /real YYYY-MM-DD/);
  assert.throws(() => generateManualQazaRecords({ prayer: "fajr", quantity: 1, missedDate: "2026-01-01", year: 2025 }, { createId: () => "id" }), /match/);
  assert.throws(() => generateManualQazaRecords({ prayer: "fajr", quantity: 1, missedDate: null, year: 0 }, { createId: () => "id" }), /Original year/);
});

test("rejects IDs that collide inside a bulk import", () => {
  assert.throws(() => generateManualQazaRecords(
    { prayer: "asr", quantity: 2 },
    { importId: "dupe", createId: () => "same-id" },
  ), /unique/);
});
