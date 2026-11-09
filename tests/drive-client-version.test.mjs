import assert from "node:assert/strict";
import { test } from "node:test";
import clientModule from "../node_modules/.cache/salah-tracker-tests/drive/client.js";
const { updateDriveJsonWithRetry } = clientModule;

test("ETag conflict reloads the remote value, merges, and retries once with If-Match", async () => {
  const originalFetch = globalThis.fetch; const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    if (init.method === "PATCH" && requests.filter((r) => r.init.method === "PATCH").length === 1) return new Response("", { status: 412, headers: { ETag: "e1" } });
    if (init.method === "PATCH") return new Response(JSON.stringify({ id: "f", version: 3 }), { status: 200, headers: { ETag: "e3" } });
    if (String(input).includes("fields=id,version")) return new Response(JSON.stringify({ id: "f", version: 2 }), { status: 200, headers: { ETag: "e2" } });
    if (String(input).includes("alt=media")) return new Response(JSON.stringify({ values: ["remote"] }), { status: 200, headers: { ETag: "e2" } });
    return new Response(JSON.stringify({}), { status: 200 });
  };
  try {
    const result = await updateDriveJsonWithRetry({ token: "test", fileId: "f", name: "file.json", data: { values: ["local"] }, etag: "e1", merge: (remote, local) => ({ values: [...remote.values, ...local.values] }) });
    assert.deepEqual(result.data.values, ["remote", "local"]); assert.equal(result.etag, "e3"); assert.equal(result.version, "3");
    const patches = requests.filter((r) => r.init.method === "PATCH"); assert.equal(patches.length, 2); assert.equal(new Headers(patches[0].init.headers).get("If-Match"), "e1"); assert.equal(new Headers(patches[1].init.headers).get("If-Match"), "e2");
  } finally { globalThis.fetch = originalFetch; }
});
