import assert from "node:assert/strict";
import { test } from "node:test";
import timingHelpers from "../node_modules/.cache/salah-tracker-tests/timings.js";

const { getPrayerWindow, prayerIsOnTime } = timingHelpers;

const makeTimings = () => ({
  date: "2026-02-28",
  location: { city: "Karachi", country: "Pakistan", method: 1 },
  timezone: "Asia/Karachi",
  timings: {
    Fajr: "2026-02-28T05:20:00+05:00",
    Sunrise: "2026-02-28T06:40:00+05:00",
    Dhuhr: "2026-02-28T12:30:00+05:00",
    Asr: "2026-02-28T16:00:00+05:00",
    Maghrib: "2026-02-28T18:20:00+05:00",
    Isha: "2026-02-28T19:45:00+05:00",
  },
});

test("getPrayerWindow returns explicit start and end dates", () => {
  const window = getPrayerWindow("fajr", makeTimings());
  assert.equal(window?.start.toISOString(), "2026-02-28T00:20:00.000Z");
  assert.equal(window?.end.toISOString(), "2026-02-28T01:40:00.000Z");
});

test("Isha stays valid at 00:30 until the cached next day's Fajr", () => {
  const timings = makeTimings();
  const nextDayFajr = "2026-03-01T05:10:00+05:00";
  const window = getPrayerWindow("isha", timings, nextDayFajr);
  assert.equal(window?.start.toISOString(), "2026-02-28T14:45:00.000Z");
  assert.equal(window?.end.toISOString(), "2026-03-01T00:10:00.000Z");
  assert.equal(prayerIsOnTime("isha", new Date("2026-03-01T00:30:00+05:00"), timings, nextDayFajr), true);
  assert.equal(prayerIsOnTime("isha", new Date(nextDayFajr), timings, nextDayFajr), false);
});

test("Isha uses the documented fallback when next day's Fajr is not cached", () => {
  const window = getPrayerWindow("isha", makeTimings());
  assert.equal(window?.end.toISOString(), "2026-03-01T01:00:00.000Z");
});

test("other prayer windows use their same-day following boundary", () => {
  const window = getPrayerWindow("dhuhr", makeTimings());
  assert.equal(window?.start.toISOString(), "2026-02-28T07:30:00.000Z");
  assert.equal(window?.end.toISOString(), "2026-02-28T11:00:00.000Z");
});
