import assert from "node:assert/strict";
import { test } from "node:test";
import qazaDetectModule from "../node_modules/.cache/salah-tracker-tests/qaza/detect.js";
import qazaRepositoryModule from "../node_modules/.cache/salah-tracker-tests/qaza/repository.js";

const { detectMissedFardPrayers } = qazaDetectModule;
const { createInMemoryQazaRepository } = qazaRepositoryModule;

test("detects only past unmarked Fard records and does not modify daily logs", async () => {
  const repository = createInMemoryQazaRepository();
  const logs = {
    "2026-11-08": { fajr: true, "fajr-sunnah": false, witr: false, tahajjud: false },
    "2026-11-09": {},
    "2026-11-10": {},
  };
  const original = structuredClone(logs);
  const created = await detectMissedFardPrayers({
    startDate: "2026-11-08",
    today: "2026-11-10",
    logs,
    nextFajrAt: "2026-11-10T05:10:00+05:00",
    repository,
    now: new Date("2026-11-10T06:00:00+05:00"),
  });
  assert.equal(created.length, 9);
  assert.ok(created.every((record) => record.source === "auto" && record.status === "pending_confirmation"));
  assert.ok(created.every((record) => record.prayer !== "witr" && !record.prayer.includes("sunnah")));
  assert.equal(created.some((record) => record.missedDate === "2026-11-10"), false);
  assert.equal(created.find((record) => record.id === "2026-11-09-isha")?.year, 2026);
  assert.deepEqual(logs, original);
  assert.equal(await repository.isDateProcessed("2026-11-08"), true);
  assert.equal(await repository.isDateProcessed("2026-11-09"), true);
});

test("defers a day's Isha until the next Fajr has passed, including after midnight", async () => {
  const repository = createInMemoryQazaRepository();
  const input = {
    startDate: "2026-11-09",
    today: "2026-11-10",
    logs: { "2026-11-09": {} },
    nextFajrAt: "2026-11-10T05:10:00+05:00",
    repository,
  };
  const afterMidnightBeforeFajr = await detectMissedFardPrayers({ ...input, now: new Date("2026-11-10T02:00:00+05:00") });
  assert.deepEqual(afterMidnightBeforeFajr.map((record) => record.prayer).sort(), ["asr", "dhuhr", "fajr", "maghrib"]);
  assert.equal(await repository.getById("2026-11-09-isha"), null);
  assert.equal(await repository.isDateProcessed("2026-11-09"), false);

  const afterFajr = await detectMissedFardPrayers({ ...input, now: new Date("2026-11-10T05:11:00+05:00") });
  assert.deepEqual(afterFajr.map((record) => record.id), ["2026-11-09-isha"]);
  assert.equal(await repository.isDateProcessed("2026-11-09"), true);
});

test("rerunning detection does not create duplicate records", async () => {
  const repository = createInMemoryQazaRepository();
  const input = {
    startDate: "2026-11-09",
    today: "2026-11-10",
    logs: { "2026-11-09": {} },
    nextFajrAt: "2026-11-10T05:10:00+05:00",
    repository,
    now: new Date("2026-11-10T06:00:00+05:00"),
  };
  const first = await detectMissedFardPrayers(input);
  const second = await detectMissedFardPrayers(input);
  assert.equal(first.length, 5);
  assert.deepEqual(second, []);
  assert.equal((await repository.getYear(2026)).length, 5);
});

test("skips dates already marked processed", async () => {
  const repository = createInMemoryQazaRepository();
  await repository.markDateProcessed("2026-11-09");
  const created = await detectMissedFardPrayers({
    startDate: "2026-11-09",
    today: "2026-11-10",
    logs: { "2026-11-09": {} },
    repository,
    now: new Date("2026-11-10T06:00:00+05:00"),
  });
  assert.deepEqual(created, []);
});

test("does not generate any records before the supplied tracking start date", async () => {
  const repository = createInMemoryQazaRepository();
  const created = await detectMissedFardPrayers({
    startDate: "2026-11-10",
    today: "2026-11-12",
    logs: { "2026-11-08": {}, "2026-11-09": {}, "2026-11-10": {}, "2026-11-11": {} },
    nextFajrAt: "2026-11-12T05:10:00+05:00",
    repository,
    now: new Date("2026-11-12T06:00:00+05:00"),
  });
  assert.ok(created.every((record) => record.missedDate >= "2026-11-10"));
  assert.equal(await repository.getById("2026-11-08-fajr"), null);
  assert.equal(await repository.getById("2026-11-09-fajr"), null);
});
