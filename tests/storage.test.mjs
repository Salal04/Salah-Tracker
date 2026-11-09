import assert from "node:assert/strict";
import { test } from "node:test";
import localStorage from "../node_modules/.cache/salah-tracker-tests/storage/local.js";

const { listKeys, localKeys, readCustomNawafil, readJson, readString, removeKey, writeCustomNawafil, writeJson, writeString } = localStorage;

class MockStorage {
  values = new Map();

  get length() {
    return this.values.size;
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }
}

test("local key builders preserve the existing key names", () => {
  assert.equal(localKeys.log("2026-11-05"), "salah-log-2026-11-05");
  assert.equal(localKeys.marks("2026-11-05"), "salah-marks-2026-11-05");
  assert.equal(localKeys.customNawafil("2026-11-05"), "salah-custom-nawafil-2026-11-05");
  assert.equal(localKeys.qazaDone, "salah-qaza-done");
  assert.equal(localKeys.driveAnalysis("a+b@example.com"), "salah-drive-analysis-a%2Bb%40example.com");
});

test("custom nawafil are stored and read for a specific day", () => {
  const storage = new MockStorage();
  const records = [{ id: "custom-nafl-1", name: "Extra prayer", rakaat: 2 }];
  writeCustomNawafil("2026-11-05", records, storage);
  assert.deepEqual(readCustomNawafil("2026-11-05", storage), records);
  assert.deepEqual(readCustomNawafil("2026-11-06", storage), []);
});

test("readJson and writeJson operate on mocked storage", () => {
  const storage = new MockStorage();
  const profile = { name: "Amina", image: "" };
  writeJson(localKeys.userProfile, profile, storage);
  assert.deepEqual(readJson(localKeys.userProfile, null, storage), profile);
});

test("readJson returns its fallback when stored JSON is malformed", () => {
  const storage = new MockStorage();
  storage.setItem(localKeys.driveDayFileIds, "{");
  assert.deepEqual(readJson(localKeys.driveDayFileIds, {}, storage), {});
});

test("string functions and key enumeration use mocked storage", () => {
  const storage = new MockStorage();
  writeString(localKeys.startDate, "2026-11-05", storage);
  assert.equal(readString(localKeys.startDate, null, storage), "2026-11-05");
  assert.deepEqual(listKeys(storage), [localKeys.startDate]);
  removeKey(localKeys.startDate, storage);
  assert.equal(readString(localKeys.startDate, null, storage), null);
});

test("storage functions are safe when browser storage is unavailable", () => {
  assert.equal(readString("missing", null, null), null);
  assert.deepEqual(readJson("missing", [], null), []);
  assert.doesNotThrow(() => writeString("key", "value", null));
  assert.doesNotThrow(() => writeJson("key", { value: true }, null));
  assert.deepEqual(listKeys(null), []);
  assert.doesNotThrow(() => removeKey("key", null));
});
