import assert from "node:assert/strict";
import { test } from "node:test";
import analysisHelpers from "../node_modules/.cache/salah-tracker-tests/analysis.js";

const { calculatePrayerStreaks, calculateTrackerAnalysis, mergeTrackerData } = analysisHelpers;
const today = "2026-01-05";

test("analysis handles empty data", () => {
  const result = calculateTrackerAnalysis({ startDate: today, logs: {}, qazaDone: [] }, today);
  assert.equal(result.totalPrayers, 0);
  assert.equal(result.totalFard, 0);
  assert.equal(result.completeFardDays, 0);
  assert.deepEqual(result.daily[today], {
    fard: 0,
    sunnah: 0,
    nafl: 0,
    onTimeFard: 0,
    onTimeExtras: 0,
    qazaCompleted: 0,
    completeFardDay: false,
    timingCity: undefined,
    timingCountry: undefined,
    timingMethod: undefined,
    timezone: undefined,
  });
});

test("analysis counts a full five-prayer day", () => {
  const logs = { [today]: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true } };
  const result = calculateTrackerAnalysis({ startDate: today, logs, qazaDone: [] }, today);
  assert.equal(result.totalFard, 5);
  assert.equal(result.completeFardDays, 1);
  assert.equal(result.daily[today].completeFardDay, true);
});

test("analysis includes completed custom nawafil in nafl totals", () => {
  const customNawafil = { [today]: [{ id: "custom-nafl-1", name: "Extra prayer", rakaat: 2 }] };
  const logs = { [today]: { "custom-nafl-1": true } };
  const result = calculateTrackerAnalysis({ startDate: today, logs, customNawafil, qazaDone: [] }, today);
  assert.equal(result.totalNafl, 1);
  assert.equal(result.totalPrayers, 1);
  assert.equal(result.totalFard, 0);
});

test("prayer streaks restart after a missed day", () => {
  const logs = {
    "2026-01-01": { fajr: true },
    "2026-01-02": { fajr: true },
    "2026-01-03": {},
    [today]: { fajr: true },
  };
  const streaks = calculatePrayerStreaks(today, today, logs[today], "2026-01-01", logs);
  assert.equal(streaks.fajr, 1);
});

test("analysis counts only completed marks recorded as on time", () => {
  const logs = { [today]: { fajr: true, dhuhr: true, asr: true } };
  const marks = { [today]: {
    fajr: { changedAt: "a", completed: true, onTime: true },
    dhuhr: { changedAt: "b", completed: true, onTime: false },
    asr: { changedAt: "c", completed: false, onTime: true },
  } };
  const result = calculateTrackerAnalysis({ startDate: today, logs, marks, qazaDone: [] }, today);
  assert.equal(result.onTimeFard, 1);
  assert.equal(result.daily[today].onTimeFard, 1);
});

test("analysis ignores logs dated before the tracking start date", () => {
  const startDate = "2026-01-03";
  const logs = {
    "2026-01-01": { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
    "2026-01-02": { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  };
  const result = calculateTrackerAnalysis({ startDate, logs, qazaDone: [] }, startDate);
  assert.equal(result.totalFard, 0);
  assert.equal(result.completeFardDays, 0);
  assert.equal(result.daily[startDate].fard, 0);
});

test("mergeTrackerData combines daily records and unique completed Qaza IDs", () => {
  const remote = { startDate: "2026-01-02", logs: { "2026-01-02": { fajr: true } }, qazaDone: ["q1"] };
  const local = { startDate: "2026-01-01", logs: { "2026-01-02": { dhuhr: true } }, qazaDone: ["q1", "q2"] };
  const merged = mergeTrackerData(remote, local);
  assert.equal(merged.startDate, "2026-01-01");
  assert.deepEqual(merged.logs["2026-01-02"], { fajr: true, dhuhr: true });
  assert.deepEqual(merged.qazaDone, ["q1", "q2"]);
});
