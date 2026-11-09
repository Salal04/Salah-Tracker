import assert from "node:assert/strict";
import { test } from "node:test";
import quotaModule from "../node_modules/.cache/salah-tracker-tests/sync/quota.js";

const { DRIVE_SYNC_QUOTA, claimSyncQuotaSlot, claimSyncQuotaSlots, createSyncQuotaState, parseSyncQuotaState } = quotaModule;
const fakeClock = (iso) => {
  let current = new Date(iso);
  return { now: () => new Date(current), set: (next) => { current = new Date(next); } };
};
const fardSlot = (prayerId, start, end) => ({ kind: "fard", prayerId, windowStart: start, windowEnd: end });

test("quota config is five fard slots plus one shared nafl slot", () => {
  assert.equal(DRIVE_SYNC_QUOTA.fardSlotsPerDay, 5);
  assert.equal(DRIVE_SYNC_QUOTA.naflSlotsPerDay, 1);
  assert.deepEqual([...DRIVE_SYNC_QUOTA.fardPrayerIds], ["fajr", "dhuhr", "asr", "maghrib", "isha"]);
});

test("each fard sync needs to occur inside its timing window", () => {
  const clock = fakeClock("2026-11-09T05:30:00+05:00");
  const initial = createSyncQuotaState("2026-11-09");
  const beforeWindow = claimSyncQuotaSlot(initial, fardSlot("fajr", "2026-11-09T05:30:01+05:00", "2026-11-09T06:40:00+05:00"), clock.now());
  assert.equal(beforeWindow.allowed, false);
  assert.equal(beforeWindow.reason, "prayer-window-closed");

  const afterWindowClock = fakeClock("2026-11-09T06:40:00+05:00");
  const afterWindow = claimSyncQuotaSlot(initial, fardSlot("fajr", "2026-11-09T05:20:00+05:00", "2026-11-09T06:40:00+05:00"), afterWindowClock.now());
  assert.equal(afterWindow.allowed, false);
  assert.equal(afterWindow.reason, "prayer-window-closed");
});

test("Isha window remains available until the following Fajr boundary", () => {
  const clock = fakeClock("2026-11-10T00:30:00+05:00");
  const state = createSyncQuotaState("2026-11-10");
  const allowed = claimSyncQuotaSlot(state, fardSlot("isha", "2026-11-09T19:45:00+05:00", "2026-11-10T05:10:00+05:00"), clock.now());
  assert.equal(allowed.allowed, true);
  clock.set("2026-11-10T05:10:00+05:00");
  const closed = claimSyncQuotaSlot(state, fardSlot("isha", "2026-11-09T19:45:00+05:00", "2026-11-10T05:10:00+05:00"), clock.now());
  assert.equal(closed.allowed, false);
  assert.equal(closed.reason, "prayer-window-closed");
});

test("each named fard prayer gets one slot, plus one shared nafl slot", () => {
  const clock = fakeClock("2026-11-09T06:00:00+05:00");
  let state = createSyncQuotaState("2026-11-09");
  const prayerIds = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  for (const prayerId of prayerIds) {
    const result = claimSyncQuotaSlot(state, fardSlot(prayerId, "2026-11-09T00:00:00+05:00", "2026-11-10T00:00:00+05:00"), clock.now());
    assert.equal(result.allowed, true);
    if (result.allowed) state = result.state;
  }
  const sixthFard = claimSyncQuotaSlot(state, fardSlot("fajr", "2026-11-09T00:00:00+05:00", "2026-11-10T00:00:00+05:00"), clock.now());
  assert.equal(sixthFard.allowed, false);
  assert.equal(sixthFard.reason, "fard-prayer-already-synced");

  const nafl = claimSyncQuotaSlot(state, { kind: "nafl" }, clock.now());
  assert.equal(nafl.allowed, true);
  const repeatedNafl = nafl.allowed ? claimSyncQuotaSlot(nafl.state, { kind: "nafl" }, clock.now()) : nafl;
  assert.equal(repeatedNafl.allowed, false);
  assert.equal(repeatedNafl.reason, "nafl-quota-used");
});

test("fake clock rolls quota state over at local midnight", () => {
  const clock = fakeClock("2026-11-09T23:59:59+05:00");
  const exhausted = { day: "2026-11-09", fardUsed: ["fajr", "dhuhr", "asr", "maghrib", "isha"], naflUsed: 1, legacyUsed: 0 };
  clock.set("2026-11-10T00:00:00+05:00");
  const nextDay = parseSyncQuotaState(JSON.stringify(exhausted), clock.now());
  assert.equal(nextDay.day, "2026-11-10");
  assert.deepEqual(nextDay.fardUsed, []);
  assert.equal(nextDay.naflUsed, 0);
});

test("legacy numeric fard counters migrate to used prayer slots", () => {
  const clock = fakeClock("2026-11-09T12:00:00+05:00");
  const migrated = parseSyncQuotaState(JSON.stringify({ day: "2026-11-09", fardUsed: 2, naflUsed: 0, legacyUsed: 0 }), clock.now());
  assert.deepEqual(migrated.fardUsed, ["fajr", "dhuhr"]);
});

test("multi-slot reservation is atomic when any timing window is closed", () => {
  const clock = fakeClock("2026-11-09T12:00:00+05:00");
  const initial = createSyncQuotaState("2026-11-09");
  const result = claimSyncQuotaSlots(initial, [
    fardSlot("dhuhr", "2026-11-09T11:00:00+05:00", "2026-11-09T13:00:00+05:00"),
    fardSlot("fajr", "2026-11-09T05:00:00+05:00", "2026-11-09T06:00:00+05:00"),
  ], clock.now());
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "prayer-window-closed");
  assert.deepEqual(result.state, initial);
});

test("legacy daily write counters migrate conservatively", () => {
  const clock = fakeClock("2026-11-09T12:00:00+05:00");
  const migrated = parseSyncQuotaState(null, clock.now(), 4);
  const result = claimSyncQuotaSlot(migrated, { kind: "nafl" }, clock.now());
  assert.equal(result.allowed, true);
  if (result.allowed) {
    const blocked = claimSyncQuotaSlot(result.state, { kind: "nafl" }, clock.now());
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.reason, "nafl-quota-used");
  }
});
