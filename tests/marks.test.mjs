import assert from "node:assert/strict";
import { test } from "node:test";
import markHelpers from "../node_modules/.cache/salah-tracker-tests/marks.js";

const { getAffirmation, reducePrayerMark } = markHelpers;

test("mark reducer records the selected oath affirmation", () => {
  const result = reducePrayerMark({}, {}, "fajr", { changedAt: "2026-11-05T01:00:00.000Z", markedAt: "2026-11-05T01:00:00.000Z", onTime: true }, "oath");
  assert.equal(result.log.fajr, true);
  assert.equal(result.marks.fajr.completed, true);
  assert.equal(result.marks.fajr.affirmation, "oath");
});

test("mark reducer records the voluntary without-oath choice", () => {
  const result = reducePrayerMark({}, {}, "dhuhr", { changedAt: "2026-11-05T07:00:00.000Z" }, "none");
  assert.equal(result.log.dhuhr, true);
  assert.equal(result.marks.dhuhr.affirmation, "none");
});

test("mark reducer unmarks an existing prayer and treats legacy marks as no oath", () => {
  const result = reducePrayerMark({ asr: true }, { asr: { changedAt: "old", completed: true } }, "asr", { changedAt: "2026-11-05T11:00:00.000Z" }, "none");
  assert.equal(result.log.asr, false);
  assert.deepEqual(result.marks.asr, { changedAt: "2026-11-05T11:00:00.000Z", completed: false, affirmation: "none" });
  assert.equal(getAffirmation({ changedAt: "old", completed: true }), "none");
});

test("marking all five fard prayers retains one timestamp and window per prayer", () => {
  const ids = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  const state = ids.reduce((current, id, index) => {
    const markedAt = `2026-11-05T0${index}:00:00.000Z`;
    return reducePrayerMark(current.log, current.marks, id, {
      changedAt: markedAt,
      markedAt,
      windowStart: `start-${id}`,
      windowEnd: `end-${id}`,
      onTime: index !== 4,
    }, "none");
  }, { log: {}, marks: {} });

  assert.deepEqual(ids.map((id) => state.marks[id].markedAt), ids.map((_, index) => `2026-11-05T0${index}:00:00.000Z`));
  for (const id of ids) {
    assert.equal(state.marks[id].windowStart, `start-${id}`);
    assert.equal(state.marks[id].windowEnd, `end-${id}`);
    assert.equal(typeof state.marks[id].onTime, "boolean");
  }
});
