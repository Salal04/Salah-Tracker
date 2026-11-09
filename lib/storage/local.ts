import type {
  DayMarks,
  DayTimings,
  CustomNafl,
  Log,
  MonthTimings,
  PrayerLocation,
  TrackerAnalysis,
  UserProfile,
} from "../types";

export interface StorageLike {
  readonly length: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
}

export const localKeys = {
  log: (day: string) => `salah-log-${day}`,
  marks: (day: string) => `salah-marks-${day}`,
  customNawafil: (day: string) => `salah-custom-nawafil-${day}`,
  syncedMarks: (day: string) => `salah-synced-marks-${day}`,
  times: (day: string, location: PrayerLocation) =>
    `salah-times-${day}-${encodeURIComponent(`${location.city}|${location.country}|${location.method}`)}`,
  timesMonth: (month: string, location: PrayerLocation) =>
    `salah-times-month-${month}-${encodeURIComponent(`${location.city}|${location.country}|${location.method}`)}`,
  timesRequest: (day: string) => `salah-times-request-${day}`,
  timesActive: (day: string) => `salah-times-active-${day}`,
  qazaDone: "salah-qaza-done",
  qazaDoneOn: "salah-qaza-done-on",
  userProfile: "salah-user-profile",
  userProfileCustom: "salah-user-profile-custom",
  startDate: "salah-start-date",
  driveFileId: "salah-drive-file-id",
  driveDayFileIds: "salah-drive-day-file-ids",
  driveDayCached: (date: string) => `salah-drive-day-cached-${date}`,
  driveEmail: "salah-drive-email",
  driveFetchedDay: "salah-drive-fetched-day",
  driveAnalysisVersion: "salah-drive-analysis-version",
  driveAnalysis: (email: string) => `salah-drive-analysis-${encodeURIComponent(email)}`,
  driveAttemptDay: (email: string) => `salah-drive-attempt-${encodeURIComponent(email)}`,
  driveManualRefresh: (email: string, day: string) => `salah-drive-manual-refresh-${encodeURIComponent(email)}-${day}`,
  drivePendingChanges: "salah-drive-pending-changes",
  driveWrites: (email: string, day: string) => `salah-drive-writes-${encodeURIComponent(email)}-${day}`,
  prayerLocation: "salah-prayer-location",
} as const;

const logKeyPattern = /^salah-log-(\d{4}-\d{2}-\d{2})$/;
const marksKeyPattern = /^salah-marks-(\d{4}-\d{2}-\d{2})$/;
const customNawafilKeyPattern = /^salah-custom-nawafil-(\d{4}-\d{2}-\d{2})$/;

export const logDateFromKey = (key: string | null | undefined): string | null => key?.match(logKeyPattern)?.[1] ?? null;
export const marksDateFromKey = (key: string | null | undefined): string | null => key?.match(marksKeyPattern)?.[1] ?? null;
export const customNawafilDateFromKey = (key: string | null | undefined): string | null => key?.match(customNawafilKeyPattern)?.[1] ?? null;
export const isSyncedMarksKey = (key: string | null | undefined): boolean => key?.startsWith("salah-synced-marks-") ?? false;

const getBrowserStorage = (): StorageLike | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const resolveStorage = (storage?: StorageLike | null): StorageLike | null =>
  storage === undefined ? getBrowserStorage() : storage;

export const readString = (
  key: string,
  fallback: string | null = null,
  storage?: StorageLike | null,
): string | null => {
  try {
    return resolveStorage(storage)?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

export const writeString = (key: string, value: string, storage?: StorageLike | null): void => {
  try {
    resolveStorage(storage)?.setItem(key, value);
  } catch {
    // Browser storage may be unavailable or full.
  }
};

export const readJson = <T>(key: string, fallback: T, storage?: StorageLike | null): T => {
  const value = readString(key, null, storage);
  if (value === null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const writeJson = <T>(key: string, value: T, storage?: StorageLike | null): void => {
  try {
    const serialized = JSON.stringify(value);
    if (serialized !== undefined) writeString(key, serialized, storage);
  } catch {
    // Ignore values that cannot be serialized.
  }
};

export const removeKey = (key: string, storage?: StorageLike | null): void => {
  try {
    resolveStorage(storage)?.removeItem(key);
  } catch {
    // Browser storage may be unavailable.
  }
};

export const listKeys = (storage?: StorageLike | null): string[] => {
  const target = resolveStorage(storage);
  if (!target) return [];
  const keys: string[] = [];
  try {
    for (let index = 0; index < target.length; index++) {
      const key = target.key(index);
      if (key !== null) keys.push(key);
    }
  } catch {
    return [];
  }
  return keys;
};

export const localStore: StorageLike = {
  get length() {
    return listKeys().length;
  },
  getItem: (key) => readString(key),
  setItem: (key, value) => writeString(key, value),
  removeItem: (key) => removeKey(key),
  key: (index) => listKeys()[index] ?? null,
};

export const readLog = (day: string): Log => readJson<Log>(localKeys.log(day), {});
export const writeLog = (day: string, value: Log): void => writeJson(localKeys.log(day), value);
export const readMarks = (day: string): DayMarks => readJson<DayMarks>(localKeys.marks(day), {});
export const writeMarks = (day: string, value: DayMarks): void => writeJson(localKeys.marks(day), value);
export const readSyncedMarks = (day: string): Record<string, string> => readJson(localKeys.syncedMarks(day), {});
export const writeSyncedMarks = (day: string, value: Record<string, string>): void => writeJson(localKeys.syncedMarks(day), value);
export const readCustomNawafil = (day: string, storage?: StorageLike | null): CustomNafl[] => {
  const value: unknown = readJson<unknown>(localKeys.customNawafil(day), [], storage);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CustomNafl => !!item && typeof item === "object" && typeof item.id === "string" && typeof item.name === "string" && (item.rakaat === undefined || (typeof item.rakaat === "number" && Number.isFinite(item.rakaat))));
};
export const readAllCustomNawafil = (): Record<string, CustomNafl[]> => {
  const records: Record<string, CustomNafl[]> = {};
  for (const key of listKeys()) {
    const day = customNawafilDateFromKey(key);
    if (day) records[day] = readCustomNawafil(day);
  }
  return records;
};
export const writeCustomNawafil = (day: string, value: CustomNafl[], storage?: StorageLike | null): void => writeJson(localKeys.customNawafil(day), value, storage);
export const readProfile = (): UserProfile | null => readJson<UserProfile | null>(localKeys.userProfile, null);
export const writeProfile = (value: UserProfile): void => writeJson(localKeys.userProfile, value);
export const readAnalysis = (email: string): TrackerAnalysis | null => readJson<TrackerAnalysis | null>(localKeys.driveAnalysis(email), null);
export const writeAnalysis = (email: string, value: TrackerAnalysis): void => writeJson(localKeys.driveAnalysis(email), value);
export const readMonthTimings = (month: string, location: PrayerLocation): MonthTimings | null => readJson<MonthTimings | null>(localKeys.timesMonth(month, location), null);
export const writeMonthTimings = (month: string, location: PrayerLocation, value: MonthTimings): void => writeJson(localKeys.timesMonth(month, location), value);
export const readDayTimings = (day: string): DayTimings | null => readJson<DayTimings | null>(localKeys.timesActive(day), null);
export const writeDayTimings = (day: string, location: PrayerLocation, value: DayTimings): void => {
  writeJson(localKeys.timesActive(day), value);
  writeJson(localKeys.times(day, location), value);
};
