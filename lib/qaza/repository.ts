import { isQazaOperation, isQazaRecord, isQazaStatistics } from "./validate";
import type { QazaOperation, QazaRecord, QazaStatistics } from "./types";

const STORE = {
  records: "records-by-year",
  statistics: "statistics",
  operations: "operations",
  processedDates: "processedDates",
  meta: "meta",
} as const;

const DEFAULT_DATABASE_NAME = "salah-tracker-qaza";
const DATABASE_VERSION = 1;
const STATISTICS_KEY = "current";

const isDateKey = (date: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

export interface QazaRepository {
  getYear(year: number): Promise<QazaRecord[]>;
  listAllRecords(): Promise<QazaRecord[]>;
  putRecords(records: QazaRecord[]): Promise<void>;
  getById(id: string): Promise<QazaRecord | null>;
  listOutstanding(): Promise<QazaRecord[]>;
  listPendingConfirmation(): Promise<QazaRecord[]>;
  addOperation(operation: QazaOperation): Promise<void>;
  listPendingOperations(): Promise<QazaOperation[]>;
  getStatistics(): Promise<QazaStatistics | null>;
  putStatistics(statistics: QazaStatistics): Promise<void>;
  isDateProcessed(date: string): Promise<boolean>;
  markDateProcessed(date: string): Promise<void>;
  getMeta<T = unknown>(key: string): Promise<T | undefined>;
  setMeta<T = unknown>(key: string, value: T): Promise<void>;
}

type StoredValue<T> = { key: string; value: T };
type ProcessedDate = { date: string; processedAt: string };

type IndexedDbOptions = {
  databaseName?: string;
  indexedDB?: IDBFactory;
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.addEventListener("success", () => resolve(request.result), { once: true });
  request.addEventListener("error", () => reject(request.error || new Error("IndexedDB request failed.")), { once: true });
});

const transactionDone = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.addEventListener("complete", () => resolve(), { once: true });
  transaction.addEventListener("abort", () => reject(transaction.error || new Error("IndexedDB transaction aborted.")), { once: true });
  transaction.addEventListener("error", () => reject(transaction.error || new Error("IndexedDB transaction failed.")), { once: true });
});

const assertRecord = (record: QazaRecord): void => {
  if (!isQazaRecord(record)) throw new TypeError("Invalid Qaza record.");
};

const assertOperation = (operation: QazaOperation): void => {
  if (!isQazaOperation(operation)) throw new TypeError("Invalid Qaza operation.");
};

const assertStatistics = (statistics: QazaStatistics): void => {
  if (!isQazaStatistics(statistics)) throw new TypeError("Invalid Qaza statistics.");
};

export const createIndexedDbQazaRepository = (options: IndexedDbOptions = {}): QazaRepository => {
  let databasePromise: Promise<IDBDatabase> | undefined;
  const getDatabase = (): Promise<IDBDatabase> => {
    if (databasePromise) return databasePromise;
    const factory = options.indexedDB ?? globalThis.indexedDB;
    if (!factory) return Promise.reject(new Error("IndexedDB is unavailable in this environment."));
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(options.databaseName || DEFAULT_DATABASE_NAME, DATABASE_VERSION);
      request.addEventListener("upgradeneeded", () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE.records)) {
          const records = database.createObjectStore(STORE.records, { keyPath: "id" });
          records.createIndex("year", "year", { unique: false });
          records.createIndex("status", "status", { unique: false });
        }
        if (!database.objectStoreNames.contains(STORE.statistics)) database.createObjectStore(STORE.statistics, { keyPath: "key" });
        if (!database.objectStoreNames.contains(STORE.operations)) {
          const operations = database.createObjectStore(STORE.operations, { keyPath: "operationId" });
          operations.createIndex("status", "status", { unique: false });
        }
        if (!database.objectStoreNames.contains(STORE.processedDates)) database.createObjectStore(STORE.processedDates, { keyPath: "date" });
        if (!database.objectStoreNames.contains(STORE.meta)) database.createObjectStore(STORE.meta, { keyPath: "key" });
      }, { once: true });
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error || new Error("Could not open Qaza IndexedDB.")), { once: true });
      request.addEventListener("blocked", () => reject(new Error("Qaza IndexedDB upgrade is blocked by another open tab.")), { once: true });
    }).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
    return databasePromise!;
  };

  const readRequest = async <T>(storeName: string, createRequest: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const database = await getDatabase();
    const transaction = database.transaction(storeName, "readonly");
    const done = transactionDone(transaction);
    const [result] = await Promise.all([requestResult(createRequest(transaction.objectStore(storeName))), done]);
    return result;
  };

  const writeRequest = async <T>(storeName: string, createRequest: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const database = await getDatabase();
    const transaction = database.transaction(storeName, "readwrite");
    const done = transactionDone(transaction);
    const [result] = await Promise.all([requestResult(createRequest(transaction.objectStore(storeName))), done]);
    return result;
  };

  return {
    async getYear(year) {
      if (!Number.isInteger(year)) throw new TypeError("Year must be an integer.");
      const rows = await readRequest<unknown[]>(STORE.records, (store) => store.index("year").getAll(year));
      return rows.filter(isQazaRecord);
    },
    async listAllRecords() {
      const rows = await readRequest<unknown[]>(STORE.records, (store) => store.getAll());
      return rows.filter(isQazaRecord);
    },
    async putRecords(records) {
      for (const record of records) assertRecord(record);
      if (records.length === 0) return;
      const database = await getDatabase();
      const transaction = database.transaction(STORE.records, "readwrite");
      const done = transactionDone(transaction);
      const store = transaction.objectStore(STORE.records);
      for (const record of records) store.put(record);
      await done;
    },
    async getById(id) {
      const value = await readRequest<unknown>(STORE.records, (store) => store.get(id));
      return isQazaRecord(value) ? value : null;
    },
    async listOutstanding() {
      const rows = await readRequest<unknown[]>(STORE.records, (store) => store.index("status").getAll("outstanding"));
      return rows.filter(isQazaRecord);
    },
    async listPendingConfirmation() {
      const rows = await readRequest<unknown[]>(STORE.records, (store) => store.index("status").getAll("pending_confirmation"));
      return rows.filter(isQazaRecord);
    },
    async addOperation(operation) {
      assertOperation(operation);
      await writeRequest(STORE.operations, (store) => store.add(operation));
    },
    async listPendingOperations() {
      const rows = await readRequest<unknown[]>(STORE.operations, (store) => store.index("status").getAll("pending"));
      return rows.filter(isQazaOperation);
    },
    async getStatistics() {
      const value = await readRequest<unknown>(STORE.statistics, (store) => store.get(STATISTICS_KEY));
      const statistics = value && typeof value === "object" ? (value as StoredValue<unknown>).value : undefined;
      return isQazaStatistics(statistics) ? statistics : null;
    },
    async putStatistics(statistics) {
      assertStatistics(statistics);
      await writeRequest(STORE.statistics, (store) => store.put({ key: STATISTICS_KEY, value: statistics } satisfies StoredValue<QazaStatistics>));
    },
    async isDateProcessed(date) {
      return readRequest<IDBValidKey | undefined>(STORE.processedDates, (store) => store.getKey(date)).then((key) => key !== undefined);
    },
    async markDateProcessed(date) {
      if (!isDateKey(date)) throw new TypeError("Processed date must use a valid YYYY-MM-DD date.");
      await writeRequest(STORE.processedDates, (store) => store.put({ date, processedAt: new Date().toISOString() } satisfies ProcessedDate));
    },
    async getMeta<T>(key: string) {
      const value = await readRequest<unknown>(STORE.meta, (store) => store.get(key));
      return value && typeof value === "object" ? (value as StoredValue<T>).value : undefined;
    },
    async setMeta<T>(key: string, value: T) {
      await writeRequest(STORE.meta, (store) => store.put({ key, value } satisfies StoredValue<T>));
    },
  };
};

export const createInMemoryQazaRepository = (): QazaRepository => {
  const records = new Map<string, QazaRecord>();
  const operations = new Map<string, QazaOperation>();
  const meta = new Map<string, unknown>();
  const processedDates = new Set<string>();
  let statistics: QazaStatistics | null = null;

  return {
    async getYear(year) {
      return [...records.values()].filter((record) => record.year === year).map((record) => ({ ...record }));
    },
    async listAllRecords() { return [...records.values()].map((record) => structuredClone(record)); },
    async putRecords(values) {
      values.forEach(assertRecord);
      for (const record of values) records.set(record.id, { ...record });
    },
    async getById(id) {
      const record = records.get(id);
      return record ? { ...record } : null;
    },
    async listOutstanding() {
      return [...records.values()].filter((record) => record.status === "outstanding").map((record) => ({ ...record }));
    },
    async listPendingConfirmation() {
      return [...records.values()].filter((record) => record.status === "pending_confirmation").map((record) => ({ ...record }));
    },
    async addOperation(operation) {
      assertOperation(operation);
      if (operations.has(operation.operationId)) throw new Error("Qaza operation ID already exists.");
      operations.set(operation.operationId, { ...operation });
    },
    async listPendingOperations() {
      return [...operations.values()].filter((operation) => operation.status === "pending").map((operation) => ({ ...operation }));
    },
    async getStatistics() {
      return statistics ? structuredClone(statistics) : null;
    },
    async putStatistics(value) {
      assertStatistics(value);
      statistics = structuredClone(value);
    },
    async isDateProcessed(date) {
      return processedDates.has(date);
    },
    async markDateProcessed(date) {
      if (!isDateKey(date)) throw new TypeError("Processed date must use a valid YYYY-MM-DD date.");
      processedDates.add(date);
    },
    async getMeta<T>(key: string) {
      return meta.has(key) ? structuredClone(meta.get(key)) as T : undefined;
    },
    async setMeta<T>(key: string, value: T) {
      meta.set(key, structuredClone(value));
    },
  };
};
