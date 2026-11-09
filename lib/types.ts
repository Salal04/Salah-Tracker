import type { LucideIcon } from "lucide-react";

export type Prayer = {
  id: string;
  name: string;
  arabic: string;
  time: string;
  icon: LucideIcon;
  kind: "fard" | "sunnah" | "nafl";
  rakaat: string;
};

export type Log = Record<string, boolean>;

export type CustomNafl = { id: string; name: string; rakaat?: number };

export type PrayerMark = {
  changedAt: string;
  completed: boolean;
  affirmation?: "oath" | "none";
  markedAt?: string;
  windowStart?: string | null;
  windowEnd?: string | null;
  onTime?: boolean;
  prayerTime?: string;
  timezone?: string;
  timingLocation?: PrayerLocation;
};

export type DayMarks = Record<string, PrayerMark>;

export type PrayerLocation = { city: string; country: string; method: number };

export type DayTimings = {
  date: string;
  location: PrayerLocation;
  timezone: string;
  timings: Record<string, string>;
};

export type MonthTimings = {
  month: string;
  location: PrayerLocation;
  timezone: string;
  days: DayTimings[];
};

export type SchoolOfThought = "Hanafi" | "Shafi'i" | "Maliki" | "Hanbali" | "Other" | "Prefer not to say";
export type UserProfile = {
  name: string;
  image: string;
  gender?: string;
  schoolOfThought?: SchoolOfThought;
  location?: { city: string; country: string };
};

export type DayAnalysis = {
  fard: number;
  sunnah: number;
  nafl: number;
  onTimeFard: number;
  onTimeExtras: number;
  qazaCompleted: number;
  completeFardDay: boolean;
  timingCity?: string;
  timingCountry?: string;
  timingMethod?: number;
  timezone?: string;
};

export type TrackerAnalysis = {
  version: 2;
  totalFard: number;
  totalSunnah: number;
  totalNafl: number;
  totalPrayers: number;
  onTimeFard: number;
  onTimeExtras: number;
  qazaCompleted: number;
  daysWithFard: number;
  completeFardDays: number;
  bestStreakDays: number;
  bestStreakPrayerId: string | null;
  bestStreakByPrayer: Record<string, number>;
  daily: Record<string, DayAnalysis>;
};

export type TrackerBackup = {
  startDate: string;
  logs: Record<string, Log>;
  marks?: Record<string, DayMarks>;
  customNawafil?: Record<string, CustomNafl[]>;
  qazaDone: string[];
  qazaDoneOn?: Record<string, string>;
  profile?: UserProfile;
  analysis?: TrackerAnalysis;
};

export type TrackerDayBackupV1 = {
  version: 1;
  date: string;
  log: Log;
  marks: DayMarks;
};

export type TrackerDayBackupV2 = {
  version: 2;
  date: string;
  log: Log;
  marks: DayMarks;
};

export type TrackerDayBackup = {
  version: 3;
  date: string;
  log: Log;
  marks: DayMarks;
  customNawafil: CustomNafl[];
};

export type ReadableTrackerDayBackup = TrackerDayBackup | TrackerDayBackupV2 | TrackerDayBackupV1;

export type TrackerSummary = {
  version: 1;
  updatedAt?: string;
  startDate: string;
  /** Aggregate only; individual Qaza records remain in the private local repository. */
  qazaTotals?: { added: number; completed: number; outstanding: number };
  qazaFileIds?: { folderId?: string; statistics?: string; years?: Record<string, string> };
  /** Legacy fields are accepted only when reading older Drive summaries. */
  qazaDone?: string[];
  qazaDoneOn?: Record<string, string>;
  profile?: UserProfile;
  analysis: TrackerAnalysis;
  dailyFileIds: Record<string, string>;
};

export type GoogleDriveFile = { id: string; name: string };
