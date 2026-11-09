import assert from "node:assert/strict";
import { test } from "node:test";
import dateUtils from "../node_modules/.cache/salah-tracker-tests/dates.js";

const { addDays, dateKey, DATE_STRING_REGEX } = dateUtils;

test("dateKey formats local dates with zero-padded month and day", () => {
  assert.equal(dateKey(new Date(2026, 0, 5, 12)), "2026-01-05");
});

test("addDays crosses month boundaries", () => {
  assert.equal(dateKey(addDays(new Date(2024, 0, 31, 12), 1)), "2024-02-01");
  assert.equal(dateKey(addDays(new Date(2024, 1, 29, 12), 1)), "2024-03-01");
});

test("addDays crosses year boundaries in both directions", () => {
  assert.equal(dateKey(addDays(new Date(2024, 11, 31, 12), 1)), "2025-01-01");
  assert.equal(dateKey(addDays(new Date(2025, 0, 1, 12), -1)), "2024-12-31");
});

test("addDays leaves its input unchanged", () => {
  const input = new Date(2025, 5, 10, 12);
  addDays(input, 3);
  assert.equal(dateKey(input), "2025-06-10");
});

test("date-string validation accepts the YYYY-MM-DD shape", () => {
  assert.equal(DATE_STRING_REGEX.test("2026-11-05"), true);
  assert.equal(DATE_STRING_REGEX.test("2026-2-05"), false);
  assert.equal(DATE_STRING_REGEX.test("November 5, 2026"), false);
});
