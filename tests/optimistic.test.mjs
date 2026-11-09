import assert from "node:assert/strict";
import { test } from "node:test";
import moduleValue from "../node_modules/.cache/salah-tracker-tests/sync/optimistic.js";
const { commitOptimistically } = moduleValue;

test("local write failure rolls optimistic state back", async () => {
  let value = "old"; await assert.rejects(commitOptimistically({ apply: () => { value = "new"; }, persistLocal: async () => { throw new Error("disk full"); }, rollback: () => { value = "old"; } }));
  assert.equal(value, "old");
});

test("Drive failure leaves successfully saved local state in place", async () => {
  let value = "old"; await commitOptimistically({ apply: () => { value = "new"; }, persistLocal: async () => "saved", rollback: () => { value = "old"; }, enqueueDrive: async () => { throw new Error("offline"); } });
  assert.equal(value, "new");
});
