import assert from "node:assert/strict";
import { test } from "node:test";
import backupHelpers from "../node_modules/.cache/salah-tracker-tests/day-backup.js";

const { migrateTrackerDayBackup } = backupHelpers;

test("v1 daily backup migration upgrades the envelope and keeps its data unchanged", () => {
  const legacy = {
    version: 1,
    date: "2026-11-05",
    log: { fajr: true },
    marks: { fajr: { changedAt: "2026-11-05T01:00:00.000Z", completed: true, markedAt: "2026-11-05T01:00:00.000Z", onTime: true } },
  };

  const migrated = migrateTrackerDayBackup(legacy);

  assert.equal(migrated.version, 3);
  assert.equal(migrated.date, legacy.date);
  assert.deepEqual(migrated.log, legacy.log);
  assert.deepEqual(migrated.marks, legacy.marks);
  assert.equal("affirmation" in migrated.marks.fajr, false);
  assert.deepEqual(migrated.customNawafil, []);
  assert.equal(legacy.version, 1);
});

test("v2 daily backup migration preserves existing records and initializes custom nawafil", () => {
  const version2 = {
    version: 2,
    date: "2026-11-06",
    log: { isha: true },
    marks: { isha: { changedAt: "2026-11-06T18:00:00.000Z", completed: true, windowStart: "2026-11-06T14:00:00.000Z", windowEnd: "2026-11-07T00:00:00.000Z" } },
  };

  const migrated = migrateTrackerDayBackup(version2);

  assert.equal(migrated.version, 3);
  assert.deepEqual(migrated.log, version2.log);
  assert.deepEqual(migrated.marks, version2.marks);
  assert.deepEqual(migrated.customNawafil, []);
});
