import assert from "node:assert/strict";
import { test } from "node:test";
import driveModule from "../node_modules/.cache/salah-tracker-tests/drive/qaza.js";
import repositoryModule from "../node_modules/.cache/salah-tracker-tests/qaza/repository.js";
import statsModule from "../node_modules/.cache/salah-tracker-tests/qaza/stats.js";

const { ensureQazaFiles, downloadQazaYear, syncQazaYearAndStatistics } = driveModule;
const { createInMemoryQazaRepository } = repositoryModule;
const { buildStatistics } = statsModule;
function fakeDrive() {
  const files = new Map([ ["summary", { id: "summary", name: "summary", data: { version: 1, startDate: "2026-01-01", analysis: {}, dailyFileIds: {} }, etag: "s1" }] ]);
  const counts = { reads: [], creates: 0, writes: 0 }; let serial = 0;
  return { files, counts,
    async findFolder(name) { return [...files.values()].find((f) => f.name === name && f.folder); },
    async createFolder(name) { const row = { id: `folder-${++serial}`, name, folder: true }; files.set(row.id, row); return row; },
    async findFile(name, parentId) { return [...files.values()].find((f) => f.name === name && f.parentId === parentId); },
    async createJson(name, data, parentId) { const row = { id: `file-${++serial}`, name, data: structuredClone(data), etag: "e1", parentId }; files.set(row.id, row); counts.creates++; return { id: row.id, etag: row.etag }; },
    async readJson(id) { counts.reads.push(id); const f = files.get(id); return { data: structuredClone(f.data), etag: f.etag, version: "1" }; },
    async updateJson(id, data, etag) { const f = files.get(id); if (etag && etag !== f.etag) throw new Error("conflict"); f.data = structuredClone(data); f.etag = `e${++serial}`; counts.writes++; return { data: f.data, etag: f.etag, version: String(serial) }; },
    async readSummary() { const f = files.get("summary"); counts.reads.push("summary"); return { data: structuredClone(f.data), etag: f.etag, version: "1" }; },
    async writeSummary(data, etag) { const f = files.get("summary"); if (etag !== f.etag) throw new Error("conflict"); f.data = structuredClone(data); f.etag = `s${++serial}`; counts.writes++; return { data: f.data, etag: f.etag, version: String(serial) }; },
  };
}
const sample = { id: "q-1", prayer: "fajr", missedDate: "2026-02-01", detectedAt: "2026-02-02T00:00:00.000Z", source: "manual", status: "outstanding", year: 2026 };

test("ensures folder and files once, stores file IDs in summary and IndexedDB metadata", async () => {
  const drive = fakeDrive(); const repository = createInMemoryQazaRepository();
  const first = await ensureQazaFiles(drive, repository, "summary", [2026]);
  const creates = drive.counts.creates; const second = await ensureQazaFiles(drive, repository, "summary", [2026]);
  assert.equal(creates, 2); assert.equal(drive.counts.creates, creates); assert.equal(first.yearFileIds["2026"], second.yearFileIds["2026"]);
  assert.equal((await repository.getMeta("drive:qaza:statisticsId")), first.statisticsId);
  assert.equal(drive.files.get("summary").data.qazaFileIds.years["2026"], first.yearFileIds["2026"]);
});

test("downloads only the requested year and uses local year cache thereafter", async () => {
  const drive = fakeDrive(); const repository = createInMemoryQazaRepository(); const files = await ensureQazaFiles(drive, repository, "summary", [2026, 2025]);
  const id = files.yearFileIds["2026"]; drive.files.get(id).data.records = [sample];
  const rows = await downloadQazaYear(drive, repository, 2026);
  assert.deepEqual(rows.map((r) => r.id), ["q-1"]); assert.deepEqual(drive.counts.reads.filter((read) => read === files.yearFileIds["2025"]), []);
  await downloadQazaYear(drive, repository, 2026); assert.equal(drive.counts.reads.filter((read) => read === id).length, 1);
});

test("uploads only changed yearly records and statistics projections", async () => {
  const drive = fakeDrive(); const repository = createInMemoryQazaRepository(); const files = await ensureQazaFiles(drive, repository, "summary", [2026]);
  await repository.putRecords([sample]); const statistics = buildStatistics([[sample]]);
  await syncQazaYearAndStatistics(drive, repository, "summary", 2026, statistics, new Date("2026-02-02T00:00:00.000Z")); const firstWrites = drive.counts.writes;
  await syncQazaYearAndStatistics(drive, repository, "summary", 2026, statistics, new Date("2026-02-02T00:00:00.000Z"));
  assert.equal(drive.counts.writes, firstWrites); assert.ok(files.yearFileIds["2026"]);
});
