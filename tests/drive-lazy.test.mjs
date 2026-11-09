import assert from "node:assert/strict";
import { test } from "node:test";
import lazyModule from "../node_modules/.cache/salah-tracker-tests/drive/lazy.js";
const { fetchRequestedDriveFiles } = lazyModule;

test("Drive hydration request count follows requested dates, not indexed history length", async () => {
  const ids = Object.fromEntries(Array.from({ length: 2000 }, (_, i) => [`2020-day-${i}`, `file-${i}`]));
  let count = 0; const loaded = await fetchRequestedDriveFiles(ids, ["2020-day-1", "2020-day-2"], async (id) => { count++; return id; });
  assert.equal(count, 2); assert.equal(Object.keys(loaded).length, 2);
});
