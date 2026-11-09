import type { QazaRepository } from "../qaza/repository";
import type { QazaRecord, QazaStatistics } from "../qaza/types";
import { mergeQazaYear, mergeSummary } from "../sync/merge";
import { buildStatistics } from "../qaza/stats";
import type { TrackerSummary } from "../types";
import { createDriveFolder, createDriveJsonInFolder, downloadDriveJson, findDriveFileByName, findDriveFileInFolder, findDriveFolderByName, uploadDriveJsonVersioned, updateDriveJsonWithRetry } from "./client";

export const QAZA_FOLDER = "Salah Tracker";
export const QAZA_STATISTICS_FILE = "qaza-statistics.json";
export const qazaYearFileName = (year: number | null) => `qaza-record-${year === null ? "undated" : year}.json`;
export type QazaYearFile = { version: 1; year: number | null; records: QazaRecord[]; updatedAt: string };
export type QazaStatisticsFile = { version: 1; statistics: QazaStatistics; updatedAt: string };
export type DriveSnapshot<T> = { data: T; etag: string | null; version: string | null };

export class QazaDriveConflictError extends Error { constructor() { super("Drive file changed since it was downloaded."); this.name = "QazaDriveConflictError"; } }
export interface QazaDrivePort {
  findFolder(name: string): Promise<{ id: string } | undefined>;
  createFolder(name: string): Promise<{ id: string }>;
  findFile(name: string, folderId?: string): Promise<{ id: string } | undefined>;
  createJson<T>(name: string, data: T, folderId: string): Promise<{ id: string; etag?: string | null; version?: string | null }>;
  readJson<T>(fileId: string): Promise<DriveSnapshot<T>>;
  updateJson<T>(fileId: string, data: T, etag?: string | null): Promise<DriveSnapshot<T>>;
}
export interface FullQazaDrivePort extends QazaDrivePort {
  readSummary(): Promise<DriveSnapshot<TrackerSummary>>;
  writeSummary(data: TrackerSummary, etag?: string | null): Promise<DriveSnapshot<TrackerSummary>>;
}

export function createGoogleQazaDrive(token: string, summaryFileId: string): FullQazaDrivePort {
  return {
    async findFolder(name) { const found = await findDriveFolderByName(token, name); return found ? { id: found.id } : undefined; },
    async createFolder(name) { return createDriveFolder(token, name); },
    async findFile(name, folderId) { const file = folderId ? await findDriveFileInFolder(token, name, folderId) : await findDriveFileByName(token, name); return file ? { id: file.id } : undefined; },
    async createJson<T>(name: string, data: T, folderId: string) { const id = await createDriveJsonInFolder(token, name, data, folderId); return { id, etag: null, version: null }; },
    async readJson<T>(fileId: string) { const result = await downloadDriveJson<T>(token, fileId, "Could not download Qaza data from Drive."); if (result.data === undefined) throw new Error("Qaza file is empty."); return { data: result.data, etag: result.etag, version: result.version || null }; },
    async updateJson<T>(fileId: string, data: T, etag?: string | null) {
      try { const result = await uploadDriveJsonVersioned(token, fileId, "Qaza data", data, etag); return { data, etag: result.etag, version: result.version }; }
      catch (error) { if (error instanceof Error && "status" in error && (error as Error & { status: number }).status === 412) throw new QazaDriveConflictError(); throw error; }
    },
    async readSummary() { const result = await downloadDriveJson<TrackerSummary>(token, summaryFileId, "Could not read the tracker summary."); if (!result.data) throw new Error("Tracker summary is empty."); return { data: result.data, etag: result.etag, version: result.version || null }; },
    async writeSummary(data, etag) { return updateDriveJsonWithRetry({ token, fileId: summaryFileId, name: "Salah Tracker Summary.json", data, etag, merge: mergeSummary }); },
  };
}
const metaKeys = { folder: "drive:qaza:folderId", statistics: "drive:qaza:statisticsId", years: "drive:qaza:yearFileIds", cachedYears: "drive:qaza:cachedYears" };
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
const stable = (value: unknown) => JSON.stringify(canonical(value));

export async function ensureQazaFiles(port: FullQazaDrivePort, repository: QazaRepository, summaryFileId: string, years: (number | null)[] = []): Promise<{ folderId: string; statisticsId: string; yearFileIds: Record<string, string> }> {
  let folderId = await repository.getMeta<string>(metaKeys.folder);
  if (!folderId) { folderId = (await port.findFolder(QAZA_FOLDER))?.id || (await port.createFolder(QAZA_FOLDER)).id; await repository.setMeta(metaKeys.folder, folderId); }
  let summary = await port.readSummary();
  const yearFileIds = { ...(await repository.getMeta<Record<string, string>>(metaKeys.years) || {}), ...(summary.data.qazaFileIds?.years || {}) };
  let statisticsId = summary.data.qazaFileIds?.statistics || await repository.getMeta<string>(metaKeys.statistics);
  if (!statisticsId) {
    statisticsId = (await port.findFile(QAZA_STATISTICS_FILE, folderId))?.id;
    if (!statisticsId) statisticsId = (await port.createJson(QAZA_STATISTICS_FILE, { version: 1, statistics: buildStatistics([]), updatedAt: new Date().toISOString() } satisfies QazaStatisticsFile, folderId)).id;
  }
  for (const year of years) {
    const key = year === null ? "undated" : String(year);
    if (yearFileIds[key]) continue;
    let fileId = (await port.findFile(qazaYearFileName(year), folderId))?.id;
    if (!fileId) fileId = (await port.createJson(qazaYearFileName(year), { version: 1, year, records: [], updatedAt: new Date().toISOString() } satisfies QazaYearFile, folderId)).id;
    yearFileIds[key] = fileId;
  }
  await repository.setMeta(metaKeys.statistics, statisticsId); await repository.setMeta(metaKeys.years, yearFileIds);
  const next = mergeSummary(summary.data, { ...summary.data, updatedAt: new Date().toISOString(), qazaFileIds: { ...(summary.data.qazaFileIds || {}), folderId, statistics: statisticsId, years: yearFileIds } });
  if (stable(next.qazaFileIds) !== stable(summary.data.qazaFileIds)) {
    summary = await port.writeSummary(next, summary.etag);
    await repository.setMeta(`drive:etag:${summaryFileId}`, { etag: summary.etag, version: summary.version });
  }
  return { folderId, statisticsId, yearFileIds };
}

export async function downloadQazaYear(port: QazaDrivePort, repository: QazaRepository, year: number, options: { force?: boolean } = {}): Promise<QazaRecord[]> {
  const cachedAt = await repository.getMeta<string>(`drive:qaza:year:${year}:downloadedAt`);
  if (!options.force && cachedAt && Date.now() - Date.parse(cachedAt) < 86_400_000) return repository.getYear(year);
  const ids = await repository.getMeta<Record<string, string>>(metaKeys.years) || {};
  const fileId = ids[String(year)]; if (!fileId) return repository.getYear(year);
  const remote = await port.readJson<QazaYearFile>(fileId);
  const records = mergeQazaYear(await repository.getYear(year), remote.data.records || []);
  await repository.putRecords(records);
  await repository.setMeta(`drive:etag:${fileId}`, { etag: remote.etag, version: remote.version });
  await repository.setMeta(`drive:qaza:year:${year}:downloadedAt`, new Date().toISOString());
  return records;
}

export async function syncQazaYearAndStatistics(port: FullQazaDrivePort, repository: QazaRepository, summaryFileId: string, year: number | null, statistics: QazaStatistics, now = new Date()): Promise<void> {
  const files = await ensureQazaFiles(port, repository, summaryFileId, [year]);
  await syncQazaYear(port, repository, year, files, now);
  await syncQazaStatistics(port, repository, summaryFileId, (await repository.getStatistics()) || statistics, files, now);
}

export async function syncQazaYear(port: QazaDrivePort, repository: QazaRepository, year: number | null, files: { folderId: string; statisticsId: string; yearFileIds: Record<string, string> }, now = new Date()): Promise<void> {
  const yearId = files.yearFileIds[year === null ? "undated" : String(year)];
  const localRecords = (await repository.listAllRecords()).filter((record) => record.year === year);
  const savedYear = await port.readJson<QazaYearFile>(yearId);
  let mergedRecords = mergeQazaYear(savedYear.data.records || [], localRecords).sort((a, b) => a.id.localeCompare(b.id));
  const savedRecords = [...(savedYear.data.records || [])].sort((a, b) => a.id.localeCompare(b.id));
  const nextYear: QazaYearFile = { version: 1, year, records: mergedRecords, updatedAt: now.toISOString() };
  if (stable(savedRecords) !== stable(nextYear.records)) {
    let result: DriveSnapshot<QazaYearFile>;
    try { result = await port.updateJson(yearId, nextYear, savedYear.etag); }
    catch (error) {
      if (!(error instanceof QazaDriveConflictError)) throw error;
      const latest = await port.readJson<QazaYearFile>(yearId);
      mergedRecords = mergeQazaYear(latest.data.records || [], nextYear.records).sort((a, b) => a.id.localeCompare(b.id));
      result = await port.updateJson(yearId, { ...nextYear, records: mergedRecords }, latest.etag);
    }
    await repository.setMeta(`drive:etag:${yearId}`, { etag: result.etag, version: result.version });
  }
  await repository.putRecords(mergedRecords);
  await repository.putStatistics(buildStatistics([await repository.listAllRecords()]));
}

export async function syncQazaStatistics(port: FullQazaDrivePort, repository: QazaRepository, summaryFileId: string, statistics: QazaStatistics, files: { folderId: string; statisticsId: string; yearFileIds: Record<string, string> }, now = new Date()): Promise<void> {
  const statsFile = await port.readJson<QazaStatisticsFile>(files.statisticsId);
  const nextStats: QazaStatisticsFile = { version: 1, statistics, updatedAt: now.toISOString() };
  if (stable(statsFile.data.statistics) !== stable(nextStats.statistics)) {
    let result: DriveSnapshot<QazaStatisticsFile>;
    try { result = await port.updateJson(files.statisticsId, nextStats, statsFile.etag); }
    catch (error) {
      if (!(error instanceof QazaDriveConflictError)) throw error;
      const latest = await port.readJson<QazaStatisticsFile>(files.statisticsId);
      result = await port.updateJson(files.statisticsId, nextStats, latest.etag);
    }
    await repository.setMeta(`drive:etag:${files.statisticsId}`, { etag: result.etag, version: result.version });
  }
  const summary = await port.readSummary();
  const summaryNext = { ...summary.data, updatedAt: now.toISOString(), qazaTotals: { added: statistics.totalAdded, completed: statistics.totalCompleted, outstanding: statistics.totalOutstanding } };
  if (stable(summary.data.qazaTotals) !== stable(summaryNext.qazaTotals)) {
    const result = await port.writeSummary(summaryNext, summary.etag);
    await repository.setMeta(`drive:etag:${summaryFileId}`, { etag: result.etag, version: result.version });
  }
}

export function createQazaQueueWorker(port: FullQazaDrivePort, repository: QazaRepository, summaryFileId: string) {
  const targets = new Map<string, Awaited<ReturnType<typeof ensureQazaFiles>>>();
  const getFiles = async (year: number | null) => {
    const key = year === null ? "undated" : String(year);
    let files = targets.get(key);
    if (!files) { files = await ensureQazaFiles(port, repository, summaryFileId, [year]); targets.set(key, files); }
    return files;
  };
  return {
    async writeYear(year: number | null) { await syncQazaYear(port, repository, year, await getFiles(year)); },
    async writeStatistics(year: number | null) { await syncQazaStatistics(port, repository, summaryFileId, (await repository.getStatistics()) || await buildStatistics(await repository.listAllRecords().then((records) => [records])), await getFiles(year)); },
    async reconcileStatistics(force = false) {
      const summary = await port.readSummary(); const ids = summary.data.qazaFileIds?.years || {};
      const statsId = summary.data.qazaFileIds?.statistics || await repository.getMeta<string>(metaKeys.statistics);
      const localStats = await repository.getStatistics();
      if (!force && statsId && localStats) {
        const remoteStats = await port.readJson<QazaStatisticsFile>(statsId);
        if (stable(remoteStats.data.statistics) === stable(localStats)) return localStats;
      }
      const downloaded: QazaRecord[] = [];
      for (const fileId of Object.values(ids)) {
        const remote = await port.readJson<QazaYearFile>(fileId); downloaded.push(...(remote.data.records || []));
      }
      const merged = mergeQazaYear(downloaded, await repository.listAllRecords()); await repository.putRecords(merged);
      const stats = buildStatistics([merged]); await repository.putStatistics(stats); return stats;
    },
    async repairStatistics(stats: QazaStatistics) { await syncQazaStatistics(port, repository, summaryFileId, stats, await ensureQazaFiles(port, repository, summaryFileId)); },
  };
}
