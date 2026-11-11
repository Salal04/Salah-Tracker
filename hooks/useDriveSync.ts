import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomNafl, DayMarks, GoogleDriveFile, Log, ReadableTrackerDayBackup, TrackerAnalysis, TrackerBackup, TrackerDayBackup, TrackerSummary, UserProfile } from "@/lib/types";
import { addDays, dateKey, DATE_STRING_REGEX } from "@/lib/dates";
import { localKeys, localStore, logDateFromKey, marksDateFromKey, customNawafilDateFromKey, isSyncedMarksKey, readCustomNawafil, readJson, writeCustomNawafil, writeJson } from "@/lib/storage/local";
import { calculateTrackerAnalysis, mergeTrackerData } from "@/lib/analysis";
import { downloadDriveJson, findDriveFileByName, listDriveFiles, renameDriveFile, uploadDriveJson, updateDriveJsonWithRetry } from "@/lib/drive/client";
import { migrateTrackerDayBackup } from "@/lib/day-backup";
import { normalizeUserProfile } from "@/lib/profile";
import { claimSyncQuotaSlots, DRIVE_SYNC_QUOTA, parseSyncQuotaState, quotaFailureMessage, type SyncSlot } from "@/lib/sync/quota";
import { mergeDailyFile, mergeSummary } from "@/lib/sync/merge";
import { createGoogleQazaDrive, downloadQazaYear, ensureQazaFiles } from "@/lib/drive/qaza";
import { fetchRequestedDriveFiles } from "@/lib/drive/lazy";
import type { QazaRepository } from "@/lib/qaza/repository";
import type { QazaRecord } from "@/lib/qaza/types";

declare global {
  interface Window {
    google?: { accounts: { oauth2: { initTokenClient: (config: { client_id: string; scope: string; callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void }) => { requestAccessToken: (options?: { prompt?: string }) => void } } } };
  }
}

const SUMMARY = "Salah Tracker Summary.json";
const LEGACY = "Salah Tracker data.json";
const ARCHIVE = "Salah Tracker Legacy backup.json";
const dayFileName = (date: string) => `Salah Tracker ${date}.json`;
const isAnalysis = (value: unknown): value is TrackerAnalysis => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TrackerAnalysis>;
  return candidate.version === 2 && Number.isFinite(candidate.totalPrayers) && Number.isFinite(candidate.totalFard) && Number.isFinite(candidate.onTimeFard) && !!candidate.daily && typeof candidate.daily === "object";
};
const readAnalysis = (email: string): TrackerAnalysis | null => {
  const value: unknown = readJson<unknown>(localKeys.driveAnalysis(email), null);
  return isAnalysis(value) ? value : null;
};
const saveAggregateStats = async (token: string, analysis: TrackerAnalysis) => {
  const response = await fetch("/api/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken: token,
      stats: {
        totalFard: analysis.totalFard,
        onTimeFard: analysis.onTimeFard,
        daysWithFard: analysis.daysWithFard,
        completeFardDays: analysis.completeFardDays,
        bestStreakDays: analysis.bestStreakDays,
      },
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not save aggregate stats to Neon.");
};
const readProfile = () => normalizeUserProfile(readJson<unknown>(localKeys.userProfile, null));
const versionKey = (id: string) => `salah-drive-version-${id}`;
const readVersion = (id: string): { etag?: string | null; version?: string | null } => readJson(versionKey(id), {});
const writeVersion = (id: string, value: { etag?: string | null; version?: string | null }) => writeJson(versionKey(id), value);
const driveCacheIsFresh = (date: string) => { const saved = Date.parse(localStore.getItem(localKeys.driveDayCached(date)) || ""); return Number.isFinite(saved) && Date.now() - saved < 86_400_000; };

type Args = {
  ready: boolean; day: Date; startDate: string; setStartDate: (value: string) => void;
  prayerLocation: { city: string; country: string; method: number };
  log: Log; marks: DayMarks; customNawafil: CustomNafl[]; qazaDone: string[]; qazaDoneOn: Record<string, string>;
  setProfile: (profile: UserProfile) => void;
  setLog: (log: Log) => void; setMarks: (marks: DayMarks) => void; setCustomNawafil: (items: CustomNafl[]) => void; setSyncedMarks: (marks: Record<string, string>) => void;
  setQazaDone: (done: string[]) => void; setQazaDoneOn: (doneOn: Record<string, string>) => void;
};

export function useDriveSync(args: Args) {
  const { ready, day, startDate, setStartDate, prayerLocation, log, marks, customNawafil, qazaDone, qazaDoneOn, setProfile, setLog, setMarks, setCustomNawafil, setSyncedMarks, setQazaDone, setQazaDoneOn } = args;
  const [gisReady, setGisReady] = useState(false);
  const [driveToken, setDriveToken] = useState("");
  const [driveFileId, setDriveFileId] = useState("");
  const [driveDayFileIds, setDriveDayFileIds] = useState<Record<string, string>>({});
  const [driveEmail, setDriveEmail] = useState("");
  const [driveStatus, setDriveStatus] = useState("");
  const [driveHydrated, setDriveHydrated] = useState(false);
  const [driveAuthChecked, setDriveAuthChecked] = useState(false);
  const [driveAnalysis, setDriveAnalysis] = useState<TrackerAnalysis | null>(null);
  const [driveFetchedDay, setDriveFetchedDay] = useState("");
  const [driveRefreshUsedToday, setDriveRefreshUsedToday] = useState(false);
  const [drivePendingChanges, setDrivePendingChanges] = useState(0);
  const [driveSyncPulse, setDriveSyncPulse] = useState(0);
  const [syncNow, setSyncNow] = useState(false);
  const [syncPrayerId, setSyncPrayerId] = useState("");
  const syncTraceId = useRef("");

  const readDayLog = (date: string): Log => {
    const value: unknown = readJson<unknown>(localKeys.log(date), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value as Log : {};
  };
  const readDayMarks = (date: string): DayMarks => {
    const value: unknown = readJson<unknown>(localKeys.marks(date), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value as DayMarks : {};
  };
  const readSynced = (date: string) => {
    const value: unknown = readJson<unknown>(localKeys.syncedMarks(date), {});
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, string> : {};
  };
  const reserveDriveQuota = async (email: string, slots: SyncSlot | SyncSlot[], now = new Date()) => {
    const reserve = () => {
      const writesKey = localKeys.driveWrites(email, dateKey(now));
      const writesToday = Number(localStore.getItem(writesKey)) || 0;
      const quotaKey = localKeys.driveQuota(email);
      const savedQuota = localStore.getItem(quotaKey);
      const state = savedQuota ? parseSyncQuotaState(savedQuota, now) : parseSyncQuotaState(null, now, writesToday);
      const result = claimSyncQuotaSlots(state, Array.isArray(slots) ? slots : [slots], now);
      if (result.allowed) {
        localStore.setItem(quotaKey, JSON.stringify(result.state));
        localStore.setItem(writesKey, String(writesToday + 1));
      }
      return result;
    };
    const lockManager = (navigator as Navigator & { locks?: { request<T>(name: string, callback: () => T): Promise<T> } }).locks;
    return lockManager
      ? lockManager.request(`salah-drive-quota:${email}:${dateKey(now)}`, reserve)
      : reserve();
  };
  const releaseDriveQuota = async (email: string, slots: SyncSlot[], now: Date) => {
    const release = () => {
      const quotaKey = localKeys.driveQuota(email);
      const state = parseSyncQuotaState(localStore.getItem(quotaKey), now);
      const fardToRelease = new Set(slots.filter((slot): slot is Extract<SyncSlot, { kind: "fard" }> => slot.kind === "fard").map((slot) => slot.prayerId));
      const naflToRelease = slots.filter((slot) => slot.kind === "nafl").length;
      writeJson(quotaKey, { ...state, fardUsed: state.fardUsed.filter((id) => !fardToRelease.has(id)), naflUsed: Math.max(0, state.naflUsed - naflToRelease) });
      const writesKey = localKeys.driveWrites(email, dateKey(now));
      localStore.setItem(writesKey, String(Math.max(0, (Number(localStore.getItem(writesKey)) || 0) - 1)));
    };
    const lockManager = (navigator as Navigator & { locks?: { request<T>(name: string, callback: () => T): Promise<T> } }).locks;
    if (lockManager) await lockManager.request(`salah-drive-quota:${email}:${dateKey(now)}`, release);
    else release();
  };
  const clearSynced = () => {
    for (let index = localStore.length - 1; index >= 0; index--) if (isSyncedMarksKey(localStore.key(index))) localStore.removeItem(localStore.key(index)!);
  };
  const collect = (minimumDate: string, viewedDay?: string, viewedLog?: Log, completedQaza?: string[], completedOn?: Record<string, string>, viewedMarks?: DayMarks, viewedCustomNawafil?: CustomNafl[]): TrackerBackup => {
    const logs: Record<string, Log> = {};
    const allMarks: Record<string, DayMarks> = {};
    const allCustomNawafil: Record<string, CustomNafl[]> = {};
    for (let index = 0; index < localStore.length; index++) {
      const key = localStore.key(index);
      const logDate = logDateFromKey(key);
      if (logDate && logDate >= minimumDate) {
        const value: unknown = readJson<unknown>(key!, {});
        if (value && typeof value === "object" && !Array.isArray(value)) logs[logDate] = value as Log;
      }
      const marksDate = marksDateFromKey(key);
      if (marksDate && marksDate >= minimumDate) {
        const value: unknown = readJson<unknown>(key!, {});
        if (value && typeof value === "object" && !Array.isArray(value)) allMarks[marksDate] = value as DayMarks;
      }
      const customDate = customNawafilDateFromKey(key);
      if (customDate && customDate >= minimumDate) allCustomNawafil[customDate] = readCustomNawafil(customDate);
    }
    if (viewedDay && viewedLog && viewedDay >= minimumDate && viewedDay <= dateKey(new Date())) logs[viewedDay] = viewedLog;
    if (viewedDay && viewedMarks && viewedDay >= minimumDate && viewedDay <= dateKey(new Date())) allMarks[viewedDay] = viewedMarks;
    if (viewedDay && viewedCustomNawafil && viewedDay >= minimumDate && viewedDay <= dateKey(new Date())) allCustomNawafil[viewedDay] = viewedCustomNawafil;
    const storedProfile = readProfile();
    const backup: TrackerBackup = { startDate: minimumDate, logs, marks: allMarks, customNawafil: allCustomNawafil, qazaDone: completedQaza || readJson<string[]>(localKeys.qazaDone, []), qazaDoneOn: completedOn || readJson<Record<string, string>>(localKeys.qazaDoneOn, {}), profile: storedProfile ? { ...storedProfile, location: { city: prayerLocation.city, country: prayerLocation.country } } : undefined };
    backup.analysis = calculateTrackerAnalysis(backup, dateKey(new Date()));
    return backup;
  };
  const restore = (backup: TrackerBackup, minimumDate: string) => {
    for (let index = localStore.length - 1; index >= 0; index--) {
      const key = localStore.key(index);
      if (logDateFromKey(key) || marksDateFromKey(key) || customNawafilDateFromKey(key)) localStore.removeItem(key!);
    }
    for (const [date, value] of Object.entries(backup.logs || {})) if (date >= minimumDate) writeJson(localKeys.log(date), value);
    for (const [date, value] of Object.entries(backup.marks || {})) if (date >= minimumDate) writeJson(localKeys.marks(date), value);
    for (const [date, value] of Object.entries(backup.customNawafil || {})) if (date >= minimumDate) writeCustomNawafil(date, value);
    const done = Array.isArray(backup.qazaDone) ? backup.qazaDone : [];
    const doneOn = backup.qazaDoneOn && typeof backup.qazaDoneOn === "object" ? backup.qazaDoneOn : {};
    writeJson(localKeys.qazaDone, done); writeJson(localKeys.qazaDoneOn, doneOn);
    localStore.setItem(localKeys.startDate, minimumDate);
    if (backup.profile && typeof backup.profile.name === "string") {
      const image = typeof backup.profile.image === "string" && backup.profile.image.length < 600_000 && (backup.profile.image.startsWith("data:image/") || backup.profile.image.startsWith("https://")) ? backup.profile.image : "";
      const restoredProfile = normalizeUserProfile({ ...backup.profile, name: backup.profile.name.slice(0, 40), image, location: { city: prayerLocation.city, country: prayerLocation.country } });
      if (restoredProfile) writeJson(localKeys.userProfile, restoredProfile);
    }
    setQazaDone(done); setQazaDoneOn(doneOn);
  };
  const recordSynced = (backup: TrackerBackup) => {
    for (const [date, dayMarks] of Object.entries(backup.marks || {})) {
      const synced = readSynced(date);
      for (const [id, mark] of Object.entries(dayMarks)) if (mark?.changedAt) synced[id] = mark.changedAt;
      writeJson(localKeys.syncedMarks(date), synced);
    }
  };
  const summary = (backup: TrackerBackup, dailyFileIds: Record<string, string>): TrackerSummary => ({ version: 1, updatedAt: new Date().toISOString(), startDate: backup.startDate, profile: backup.profile, analysis: backup.analysis || calculateTrackerAnalysis(backup, dateKey(new Date())), dailyFileIds });
  const saveDayFile = async (token: string, fileId: string | null, date: string, data: TrackerDayBackup): Promise<string> => {
    const name = dayFileName(date);
    if (!fileId) return uploadDriveJson(token, null, name, data);
    const result = await updateDriveJsonWithRetry({ token, fileId, name, data, etag: readVersion(fileId).etag, merge: mergeDailyFile });
    writeVersion(fileId, { etag: result.etag, version: result.version });
    return fileId;
  };
  const saveSummaryFile = async (token: string, fileId: string, data: TrackerSummary): Promise<void> => {
    const result = await updateDriveJsonWithRetry({ token, fileId, name: SUMMARY, data, etag: readVersion(fileId).etag, merge: mergeSummary });
    writeVersion(fileId, { etag: result.etag, version: result.version });
  };
  const ensureDailyFiles = async (token: string, known: Record<string, string>, backup: TrackerBackup, beforeWrite: () => Promise<void>) => {
    const dates = [...new Set([...Object.keys(backup.logs || {}), ...Object.keys(backup.marks || {}), ...Object.keys(backup.customNawafil || {})])].filter((date) => DATE_STRING_REGEX.test(date)).sort();
    const next = { ...known };
    for (let index = 0; index < dates.length; index += 8) await Promise.all(dates.slice(index, index + 8).map(async (date) => {
      if (next[date]) return;
      await beforeWrite();
      next[date] = await saveDayFile(token, null, date, { version: 3, date, log: backup.logs[date] || {}, marks: backup.marks?.[date] || {}, customNawafil: backup.customNawafil?.[date] || [] });
      localStore.setItem(localKeys.driveDayCached(date), new Date().toISOString());
    }));
    return next;
  };

  useEffect(() => {
    if (!ready) return;
    setDrivePendingChanges(Number(localStore.getItem(localKeys.drivePendingChanges)) || 0);
    const ids: unknown = readJson<unknown>(localKeys.driveDayFileIds, {});
    setDriveDayFileIds(ids && typeof ids === "object" && !Array.isArray(ids) ? ids as Record<string, string> : {});
    const email = localStore.getItem(localKeys.driveEmail) || "";
    setDriveEmail(email);
    setDriveRefreshUsedToday(!!email && localStore.getItem(localKeys.driveManualRefresh(email, dateKey(new Date()))) === "1");
    setDriveAnalysis(email ? readAnalysis(email) : null);
    setDriveFetchedDay(localStore.getItem(localKeys.driveFetchedDay) || "");
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void fetch("/api/auth/google/access-token", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        if (active) {
          setDriveStatus(result?.error || "Sign in with Google Drive to continue."); setDriveAuthChecked(true);
          if (result?.error?.toLowerCase().includes("suspended")) window.location.replace("/sign-in?error=suspended");
        }
        return;
      }
      const restored = await response.json() as {
        accessToken?: string;
        summaryFileId?: string | null;
        account?: { email?: string; name?: string; profilePictureUrl?: string | null };
      };
      if (!active) return;
      setDriveAuthChecked(true);
      if (!restored.accessToken || !restored.account?.email) return;
      const email = restored.account.email;
      const summaryId = restored.summaryFileId || localStore.getItem(localKeys.driveFileId) || "";
      setDriveToken(restored.accessToken);
      setDriveEmail(email);
      setDriveAnalysis(readAnalysis(email));
      if (summaryId) {
        setDriveFileId(summaryId);
        localStore.setItem(localKeys.driveFileId, summaryId);
        setDriveHydrated(true);
      }
      localStore.setItem(localKeys.driveEmail, email);
      if (localStore.getItem(localKeys.userProfileCustom) !== "1") {
        const profile = {
          name: (restored.account.name || email.split("@")[0] || "Your name").slice(0, 40),
          image: restored.account.profilePictureUrl || "",
          location: { city: prayerLocation.city, country: prayerLocation.country },
        };
        writeJson(localKeys.userProfile, profile);
        setProfile(profile);
      }
      setDriveStatus("Google Drive session restored.");
    }).catch(() => {
      if (active) { console.warn("[auth] Could not restore the saved Google session."); setDriveAuthChecked(true); }
    });
    return () => { active = false; };
  }, [ready, prayerLocation.city, prayerLocation.country, setProfile]);
  useEffect(() => {
    if (!ready) return;
    void fetch("/api/stats/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localDay: dateKey(new Date()) }),
      cache: "no-store",
    }).then(async (response) => {
      if (response.status === 401) return;
      if (!response.ok) {
        console.warn("[stats] Automatic daily Drive sync did not complete.");
        return;
      }
      const result = await response.json() as { synced?: boolean };
      if (result.synced) console.info("[stats] Automatic daily Drive stats sync completed.");
    }).catch(() => console.warn("[stats] Automatic daily Drive sync is unavailable."));
  }, [ready]);
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client"; script.async = true;
    script.onload = () => setGisReady(true);
    script.onerror = () => setDriveStatus("Could not load Google sign-in. Check your connection.");
    document.head.appendChild(script); return () => script.remove();
  }, []);
  useEffect(() => {
    if (!ready || !driveEmail) return;
    const check = () => setDriveRefreshUsedToday(localStore.getItem(localKeys.driveManualRefresh(driveEmail, dateKey(new Date()))) === "1");
    check(); const interval = window.setInterval(check, 60_000); return () => window.clearInterval(interval);
  }, [ready, driveEmail]);
  useEffect(() => {
    if (!ready || !driveToken) return;
    let active = true;
    const checkAccount = async () => {
      try {
        const response = await fetch("/api/auth/google/status", { cache: "no-store" });
        const result = await response.json() as { suspended?: boolean };
        if (active && result.suspended) {
          setDriveStatus("This account is suspended. Contact an administrator for help.");
          setDriveToken(""); setDriveFileId(""); setDriveEmail(""); setDriveHydrated(false);
          window.location.replace("/sign-in?error=suspended");
        }
      } catch { /* Keep the current session if the brief account check is unavailable. */ }
    };
    const interval = window.setInterval(() => void checkAccount(), 30_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [ready, driveToken]);
  const queueDriveChange = (slot: SyncSlot = { kind: "nafl" }) => {
    const pending = (Number(localStore.getItem(localKeys.drivePendingChanges)) || 0) + 1;
    localStore.setItem(localKeys.drivePendingChanges, String(pending)); setDrivePendingChanges(pending);
    const syncDays = readJson<string[]>(localKeys.drivePendingSyncDays, []);
    const dayKey = dateKey(day);
    if (!syncDays.includes(dayKey)) writeJson(localKeys.drivePendingSyncDays, [...syncDays, dayKey]);
    const syncSlots = readJson<SyncSlot[]>(localKeys.drivePendingSyncSlots, []);
    const nextSlots = slot.kind === "fard"
      ? [...syncSlots.filter((current) => current.kind !== "fard" || current.prayerId !== slot.prayerId), slot]
      : syncSlots.some((current) => current.kind === "nafl") ? syncSlots : [...syncSlots, slot];
    writeJson(localKeys.drivePendingSyncSlots, nextSlots);
  };

  useEffect(() => {
    if (!driveToken || !driveFileId || !driveHydrated || !ready || !startDate || (drivePendingChanges === 0 && !syncNow)) {
      if (syncNow) console.warn("[drive-sync] Sync effect stopped by a precondition", { traceId: syncTraceId.current, hasToken: !!driveToken, hasSummaryFile: !!driveFileId, hydrated: driveHydrated, ready, hasStartDate: !!startDate, pendingChanges: drivePendingChanges });
      return;
    }
    const today = dateKey(new Date());
    const traceId = syncTraceId.current || `auto-${Date.now()}`;
    console.info("[drive-sync] Sync effect scheduled", { traceId, prayerId: syncPrayerId || null, immediate: syncNow, pendingChanges: drivePendingChanges, day: dateKey(day) });
    setDriveStatus("Changes saved here; Drive backup is queued.");
    const pendingAtStart = drivePendingChanges;
    const timeout = window.setTimeout(async () => {
      console.info("[drive-sync] Sync execution started", { traceId });
      setDriveStatus("Saving the daily file and summary to Google Drive…");
      const now = new Date();
      const dirtyFardMarks: Array<{ id: string; mark: DayMarks[string]; day: string }> = [];
      for (let index = 0; index < localStore.length; index++) {
        const key = localStore.key(index);
        const marksDay = marksDateFromKey(key);
        if (!marksDay || !key) continue;
        const dayMarks = marksDay === dateKey(day) ? marks : readDayMarks(marksDay);
        const synced = readSynced(marksDay);
        for (const id of DRIVE_SYNC_QUOTA.fardPrayerIds) {
          const mark = dayMarks[id];
          if (mark?.changedAt && mark.changedAt !== synced[id]) dirtyFardMarks.push({ id, mark, day: marksDay });
        }
      }
      const windowOpen = (mark: DayMarks[string] | undefined) => {
        const start = mark?.windowStart ? new Date(mark.windowStart) : undefined;
        const end = mark?.windowEnd ? new Date(mark.windowEnd) : undefined;
        return !!start && !!end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && now >= start && now < end;
      };
      const selectedMark = dirtyFardMarks.find(({ id, day: markDay }) => id === syncPrayerId && markDay === dateKey(day));
      if (selectedMark && !windowOpen(selectedMark.mark)) {
        console.warn("[drive-sync] Sync stopped: selected prayer window closed", { traceId, prayerId: selectedMark.id, prayerDay: selectedMark.day, windowStart: selectedMark.mark.windowStart || null, windowEnd: selectedMark.mark.windowEnd || null, now: now.toISOString() });
        setDriveStatus(quotaFailureMessage("prayer-window-closed")); setSyncNow(false); setSyncPrayerId("");
        return;
      }
      const pendingSlots = readJson<SyncSlot[]>(localKeys.drivePendingSyncSlots, []);
      const fardSlots = new Map<string, SyncSlot>();
      for (const { id, mark } of dirtyFardMarks.filter(({ mark }) => windowOpen(mark))) {
        if (!fardSlots.has(id)) fardSlots.set(id, { kind: "fard", prayerId: id, windowStart: mark.windowStart, windowEnd: mark.windowEnd });
      }
      for (const slot of pendingSlots) if (slot.kind === "fard" && windowOpen({ changedAt: "", completed: false, affirmation: "none", windowStart: slot.windowStart, windowEnd: slot.windowEnd }) && !fardSlots.has(slot.prayerId)) fardSlots.set(slot.prayerId, slot);
      const quotaSlots: SyncSlot[] = [...fardSlots.values()];
      const hasPendingNafl = pendingSlots.some((slot) => slot.kind === "nafl");
      if (!quotaSlots.length && dirtyFardMarks.length && !hasPendingNafl) {
        console.warn("[drive-sync] Sync stopped: no eligible prayer sync slots", { traceId, dirtyFardPrayerIds: dirtyFardMarks.map(({ id }) => id), pendingNafl: hasPendingNafl });
        setDriveStatus(quotaFailureMessage("prayer-window-closed")); setSyncNow(false); setSyncPrayerId("");
        return;
      }
      if (hasPendingNafl || quotaSlots.length === 0) quotaSlots.push({ kind: "nafl" });
      let quotaResult;
      try {
        console.info("[drive-sync] Checking daily Drive quota", { traceId, slots: quotaSlots.map((slot) => slot.kind === "fard" ? { kind: slot.kind, prayerId: slot.prayerId } : slot), accountConnected: !!driveEmail });
        quotaResult = await reserveDriveQuota(driveEmail, quotaSlots, now);
      } catch (error) {
        console.error("[drive-sync] Quota check failed", { traceId, error: error instanceof Error ? { name: error.name, message: error.message } : String(error) });
        setSyncNow(false); setSyncPrayerId("");
        setDriveStatus(error instanceof Error ? `Could not start Drive sync: ${error.message} Your changes remain saved on this device; retry Sync.` : "Could not start Drive sync. Your changes remain saved on this device; retry Sync.");
        return;
      }
      if (!quotaResult.allowed) {
        console.warn("[drive-sync] Sync stopped: quota rejected", { traceId, reason: quotaResult.reason });
        setDriveStatus(quotaFailureMessage(quotaResult.reason)); setSyncNow(false); setSyncPrayerId("");
        if (quotaResult.reason !== "prayer-window-closed" && quotaResult.reason !== "invalid-prayer") {
          const tomorrow = new Date(); tomorrow.setHours(24, 0, 3, 0);
          window.setTimeout(() => setDriveSyncPulse((pulse) => pulse + 1), Math.max(1000, tomorrow.getTime() - Date.now()));
        }
        return;
      }
      const backup = collect(startDate, dateKey(day), log, qazaDone, qazaDoneOn, marks, customNawafil);
      const date = dateKey(day);
      const queuedDays = readJson<string[]>(localKeys.drivePendingSyncDays, []);
      const datesToSync = [...new Set([...queuedDays, ...dirtyFardMarks.map(({ day: markDay }) => markDay)].filter((entry) => DATE_STRING_REGEX.test(entry)))];
      if (datesToSync.length === 0) datesToSync.push(date);
      console.info("[drive-sync] Preparing Drive writes", { traceId, dates: datesToSync, pendingChanges: pendingAtStart, knownDailyFileCount: Object.keys(driveDayFileIds).length });
      void (async () => {
        const savedIds: unknown = readJson<unknown>(localKeys.driveDayFileIds, {});
        const nextIds = { ...(savedIds && typeof savedIds === "object" && !Array.isArray(savedIds) ? savedIds as Record<string, string> : {}), ...driveDayFileIds };
        for (const syncDate of datesToSync) {
          console.info("[drive-sync] Writing daily Drive file", { traceId, date: syncDate, existingFile: !!nextIds[syncDate] });
          const dayId = await saveDayFile(driveToken, nextIds[syncDate] || null, syncDate, { version: 3, date: syncDate, log: backup.logs[syncDate] || {}, marks: backup.marks?.[syncDate] || {}, customNawafil: backup.customNawafil?.[syncDate] || [] });
          nextIds[syncDate] = dayId;
          writeJson(localKeys.driveDayFileIds, nextIds);
          localStore.setItem(localKeys.driveDayCached(syncDate), new Date().toISOString());
        }
        console.info("[drive-sync] Writing Drive summary", { traceId, dailyFileCount: datesToSync.length });
        await saveSummaryFile(driveToken, driveFileId, summary(backup, nextIds));
        writeJson(localKeys.driveDayFileIds, nextIds); setDriveDayFileIds(nextIds);
        const analysis = backup.analysis!;
        writeJson(localKeys.driveAnalysis(driveEmail), analysis); localStore.setItem(localKeys.driveAnalysisVersion, "3"); localStore.setItem(localKeys.driveFetchedDay, today);
        setDriveAnalysis(analysis); setDriveFetchedDay(today);
        void saveAggregateStats(driveToken, analysis).catch(() => setDriveStatus("Drive updated, but aggregate stats could not be saved to Neon."));
        recordSynced(backup); setSyncedMarks(readSynced(dateKey(day))); setSyncNow(false); setSyncPrayerId("");
        const pending = Math.max(0, (Number(localStore.getItem(localKeys.drivePendingChanges)) || 0) - pendingAtStart);
        localStore.setItem(localKeys.drivePendingChanges, String(pending)); setDrivePendingChanges(pending);
        const currentPendingDays = readJson<string[]>(localKeys.drivePendingSyncDays, []);
        let remainingDays = currentPendingDays.filter((entry) => !datesToSync.includes(entry));
        if (pending > 0 && remainingDays.length === 0) remainingDays = [dateKey(day)];
        writeJson(localKeys.drivePendingSyncDays, remainingDays);
        const usedFardIds = new Set(fardSlots.keys());
        const currentPendingSlots = readJson<SyncSlot[]>(localKeys.drivePendingSyncSlots, []);
        const remainingSlots = currentPendingSlots.filter((entry) => entry.kind === "nafl"
          ? !quotaSlots.some((used) => used.kind === "nafl")
          : !usedFardIds.has(entry.prayerId));
        writeJson(localKeys.drivePendingSyncSlots, remainingSlots);
        setDriveStatus(`Drive updated: ${dayFileName(date)} and ${SUMMARY}.`);
        console.info("[drive-sync] Sync completed", { traceId, dates: datesToSync, remainingPendingChanges: pending });
      })().catch(async (error: unknown) => {
        console.error("[drive-sync] Drive write failed", { traceId, error: error instanceof Error ? { name: error.name, message: error.message, ...("status" in error ? { status: (error as Error & { status?: number }).status } : {}) } : String(error) });
        await releaseDriveQuota(driveEmail, quotaSlots, now);
        setSyncNow(false); setSyncPrayerId("");
        setDriveStatus(error instanceof Error ? `Drive sync failed: ${error.message} Your changes remain saved on this device; retry Sync.` : "Drive sync failed. Your changes remain saved on this device; retry Sync.");
      });
    }, syncNow ? 0 : DRIVE_SYNC_QUOTA.debounceMs);
    return () => {
      if (syncNow) console.info("[drive-sync] Scheduled sync effect cleaned up", { traceId });
      window.clearTimeout(timeout);
    };
  }, [driveToken, driveFileId, driveDayFileIds, driveHydrated, ready, startDate, drivePendingChanges, driveEmail, driveSyncPulse, day, log, marks, customNawafil, qazaDone, qazaDoneOn, syncNow, syncPrayerId]);

  // OAuth connection and restore are kept in one hook so no token reaches browser storage.
  const connectGoogleDrive = (prompt = "select_account", forceRefresh = false) => {
    console.info("[auth] Google Drive sign-in started.");
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) { setDriveStatus("Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to .env.local to enable Google Drive."); return; }
    if (!gisReady || !window.google) { setDriveStatus("Google sign-in is still loading. Try again in a moment."); return; }
    setDriveStatus("Connecting and checking your Google Drive data…");
    const tokenClient = window.google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: "openid email profile https://www.googleapis.com/auth/drive.file", callback: async (response) => {
      if (!response.access_token) { console.info("[auth] Google Drive sign-in was cancelled or denied."); setDriveStatus(response.error || "Google sign-in was cancelled."); return; }
      try {
        const token = response.access_token;
        const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token}` } });
        if (!profileResponse.ok) throw new Error("Could not read your Google account.");
        const googleAccount = await profileResponse.json() as { email?: string; name?: string; picture?: string };
        const saveResponse = await fetch("/api/auth/google/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: token }),
          cache: "no-store",
        });
        if (!saveResponse.ok) {
          const result = await saveResponse.json().catch(() => null) as { error?: string } | null;
          throw new Error(result?.error || "Could not save your Google account. Please try again.");
        }
        const email = googleAccount.email || "Google account"; const today = dateKey(new Date());
        setDriveRefreshUsedToday(localStore.getItem(localKeys.driveManualRefresh(email, today)) === "1");
        const cachedId = localStore.getItem(localKeys.driveFileId) || "";
        const cached: unknown = readJson<unknown>(localKeys.driveDayFileIds, {});
        let ids = cached && typeof cached === "object" && !Array.isArray(cached) ? cached as Record<string, string> : {};
        const sameAccount = localStore.getItem(localKeys.driveEmail) === email;
        let bootstrapQuotaReservation: Promise<void> | null = null;
        const reserveBootstrapQuota = () => {
          if (!bootstrapQuotaReservation) {
            bootstrapQuotaReservation = (async () => {
              const result = await reserveDriveQuota(email, { kind: "nafl" });
              if (!result.allowed) throw new Error(quotaFailureMessage(result.reason));
            })();
          }
          return bootstrapQuotaReservation;
        };
        if (!sameAccount) ids = {};
        if (localStore.getItem(localKeys.userProfileCustom) !== "1" && (!sameAccount || !localStore.getItem(localKeys.userProfile))) {
          const googleProfile = { name: (googleAccount.name || email.split("@")[0] || "Your name").slice(0, 40), image: googleAccount.picture || "", location: { city: prayerLocation.city, country: prayerLocation.country } };
          writeJson(localKeys.userProfile, googleProfile); setProfile(googleProfile);
        }
        if (!sameAccount) { clearSynced(); setSyncedMarks({}); }
        const fresh = !forceRefresh && sameAccount && cachedId && localStore.getItem(localKeys.driveFetchedDay) === today && localStore.getItem(localKeys.driveAnalysisVersion) === "3";
        if (fresh) {
          const analysis = readAnalysis(email) || calculateTrackerAnalysis(collect(startDate, dateKey(day), log, qazaDone, qazaDoneOn, marks, customNawafil), today);
          setDriveFileId(cachedId); setDriveToken(token); setDriveEmail(email); setDriveAnalysis(analysis); setDriveFetchedDay(today); setDriveHydrated(true); setDriveStatus("Using today’s local copy. Drive is checked once per day.");
          void saveAggregateStats(token, analysis).catch(() => setDriveStatus("Drive is connected, but aggregate stats could not be saved to Neon."));
          return;
        }
        if (localStore.getItem(localKeys.driveAttemptDay(email)) === today) { setDriveStatus("Drive was already checked today. Your saved local history is still available."); return; }
        localStore.setItem(localKeys.driveAttemptDay(email), today);
        let file: GoogleDriveFile | undefined;
        if (sameAccount && cachedId && localStore.getItem(localKeys.driveAnalysisVersion) === "3") file = { id: cachedId, name: SUMMARY };
        else {
          file = await findDriveFileByName(token, SUMMARY);
          if (!file) {
            file = await findDriveFileByName(token, LEGACY);
            if (file) for (const item of await listDriveFiles(token, "name contains 'Salah Tracker' and trashed=false", 1000, "Could not index your existing daily files in Drive.")) {
              const match = item.name.match(/^Salah Tracker (\d{4}-\d{2}-\d{2})\.json$/); if (match) ids[match[1]] = item.id;
            }
          }
        }
        let id: string;
        if (file) {
          const summaryDownload = await downloadDriveJson<TrackerSummary | TrackerBackup>(token, file.id, "Could not download your tracker from Drive.");
          const data = summaryDownload.data;
          writeVersion(file.id, { etag: summaryDownload.etag, version: summaryDownload.version });
          let downloaded: TrackerBackup;
          if (file.name === SUMMARY) {
            const sum = data as TrackerSummary; ids = sum.dailyFileIds && typeof sum.dailyFileIds === "object" ? sum.dailyFileIds : ids;
            const logs: Record<string, Log> = {}; const allMarks: Record<string, DayMarks> = {}; const allCustomNawafil: Record<string, CustomNafl[]> = {};
            const datesToLoad = [...new Set([today, dateKey(day)])];
            const toFetch = datesToLoad.filter((date) => ids[date] && (forceRefresh || !driveCacheIsFresh(date)));
            const remoteDays = await fetchRequestedDriveFiles(ids, toFetch, (id, date) => downloadDriveJson<ReadableTrackerDayBackup>(token, id, `Could not download the ${date} tracker file from Drive.`, [404]));
            for (const date of datesToLoad) {
              const dayId = ids[date];
              if (!forceRefresh && driveCacheIsFresh(date)) { logs[date] = readDayLog(date); allMarks[date] = readDayMarks(date); allCustomNawafil[date] = readCustomNawafil(date); continue; }
              if (!dayId) { logs[date] = readDayLog(date); allMarks[date] = readDayMarks(date); allCustomNawafil[date] = readCustomNawafil(date); continue; }
              const dayDownload = remoteDays[date]; if (!dayDownload) continue;
              writeVersion(dayId, { etag: dayDownload.etag, version: dayDownload.version });
              if (dayDownload.status === 404 || !dayDownload.data) { delete ids[date]; logs[date] = readDayLog(date); allMarks[date] = readDayMarks(date); allCustomNawafil[date] = readCustomNawafil(date); continue; }
              const record = migrateTrackerDayBackup(dayDownload.data);
              if (record.date === date) { logs[date] = record.log || {}; allMarks[date] = record.marks || {}; allCustomNawafil[date] = record.customNawafil || []; writeJson(localKeys.log(date), logs[date]); writeJson(localKeys.marks(date), allMarks[date]); writeCustomNawafil(date, allCustomNawafil[date]); localStore.setItem(localKeys.driveDayCached(date), new Date().toISOString()); }
            }
            downloaded = { startDate: sum.startDate, logs, marks: allMarks, customNawafil: allCustomNawafil, qazaDone: sum.qazaDone || [], qazaDoneOn: sum.qazaDoneOn || {}, profile: sum.profile, analysis: sum.analysis };
          } else downloaded = data as TrackerBackup;
          const validStart = DATE_STRING_REGEX.test(downloaded.startDate) ? downloaded.startDate : (localStore.getItem(localKeys.startDate) || today);
          const remote: TrackerBackup = { startDate: validStart, logs: downloaded.logs || {}, marks: downloaded.marks || {}, customNawafil: downloaded.customNawafil || {}, qazaDone: Array.isArray(downloaded.qazaDone) ? downloaded.qazaDone : [], qazaDoneOn: downloaded.qazaDoneOn || {} };
          setDriveFetchedDay(today);
          const local = collect(localStore.getItem(localKeys.startDate) || validStart, dateKey(day), log, qazaDone, qazaDoneOn, marks, customNawafil);
          const localPending = sameAccount ? Number(localStore.getItem(localKeys.drivePendingChanges)) || 0 : 0;
          const needsAnalysis = file.name !== SUMMARY && (downloaded.analysis?.version !== 2 || !downloaded.qazaDoneOn || !downloaded.marks);
          const needsProfileLocation = !downloaded.profile?.location || downloaded.profile.location.city !== prayerLocation.city || downloaded.profile.location.country !== prayerLocation.country;
          const pending = Math.max(localPending, needsAnalysis || !downloaded.profile || needsProfileLocation || !sameAccount ? 1 : 0);
          const backup = !sameAccount || localPending > 0 ? mergeTrackerData(remote, local) : remote;
          const analysis = file.name === SUMMARY && isAnalysis(downloaded.analysis) ? downloaded.analysis : calculateTrackerAnalysis(backup, today); writeJson(localKeys.driveAnalysis(email), analysis); setDriveAnalysis(analysis);
          void saveAggregateStats(token, analysis).catch(() => setDriveStatus("Drive data is available, but aggregate stats could not be saved to Neon."));
          if (file.name !== SUMMARY) ids = await ensureDailyFiles(token, ids, backup, reserveBootstrapQuota);
          if (file.name === LEGACY) { await reserveBootstrapQuota(); id = await uploadDriveJson(token, null, SUMMARY, summary(backup, ids)); await renameDriveFile(token, file.id, ARCHIVE, readVersion(file.id).etag); } else id = file.id;
          const minimumDate = backup.startDate; restore(backup, minimumDate);
          setProfile(readProfile() || { name: "", image: "" }); recordSynced(remote);
          setStartDate(minimumDate); setLog(readDayLog(dateKey(day))); setMarks(readDayMarks(dateKey(day))); setCustomNawafil(readCustomNawafil(dateKey(day))); setSyncedMarks(readSynced(dateKey(day)));
          localStore.setItem(localKeys.drivePendingChanges, String(pending)); setDrivePendingChanges(pending);
          localStore.setItem(localKeys.driveAnalysisVersion, "3");
        } else {
          const minimumDate = localStore.getItem(localKeys.startDate) || today;
          const backup = collect(minimumDate, dateKey(day), log, qazaDone, qazaDoneOn, marks, customNawafil);
          ids = await ensureDailyFiles(token, ids, backup, reserveBootstrapQuota); await reserveBootstrapQuota(); id = await uploadDriveJson(token, null, SUMMARY, summary(backup, ids));
          recordSynced(backup); setSyncedMarks(readSynced(dateKey(day)));
          if (backup.analysis) {
            writeJson(localKeys.driveAnalysis(email), backup.analysis); setDriveAnalysis(backup.analysis); setDriveFetchedDay(today);
            void saveAggregateStats(token, backup.analysis).catch(() => setDriveStatus("Drive data is available, but aggregate stats could not be saved to Neon."));
          }
          setStartDate(minimumDate); localStore.setItem(localKeys.drivePendingChanges, "0"); setDrivePendingChanges(0); localStore.setItem(localKeys.driveAnalysisVersion, "3");
        }
        localStore.setItem(localKeys.driveFileId, id); writeJson(localKeys.driveDayFileIds, ids); setDriveDayFileIds(ids);
        localStore.setItem(localKeys.driveEmail, email); localStore.setItem(localKeys.driveFetchedDay, today);
        setDriveFileId(id); setDriveToken(token); setDriveEmail(email); setDriveHydrated(true); setDriveStatus("Drive checked today. Prayer history is cached here; updates sync in batches.");
      } catch (error) { setDriveStatus(error instanceof Error ? error.message : "Could not connect to Google Drive."); }
    } });
    tokenClient.requestAccessToken({ prompt });
  };
  const refreshDriveData = () => {
    if (driveEmail) {
      const today = dateKey(new Date()); const key = localKeys.driveManualRefresh(driveEmail, today);
      if (localStore.getItem(key) === "1") { setDriveRefreshUsedToday(true); setDriveStatus("Manual Drive refresh is limited to once per day."); return; }
      localStore.setItem(key, "1"); setDriveRefreshUsedToday(true); localStore.removeItem(localKeys.driveFetchedDay); localStore.removeItem(localKeys.driveAttemptDay(driveEmail));
    }
    connectGoogleDrive("", true);
  };
  const loadDriveDay = useCallback(async (date: string) => {
    if (!driveToken || !DATE_STRING_REGEX.test(date) || driveCacheIsFresh(date)) return;
    const fileId = driveDayFileIds[date]; if (!fileId) return;
    const result = await downloadDriveJson<ReadableTrackerDayBackup>(driveToken, fileId, `Could not download the ${date} tracker file from Drive.`, [404]);
    writeVersion(fileId, { etag: result.etag, version: result.version });
    if (result.status === 404 || !result.data) return;
    const record = migrateTrackerDayBackup(result.data); if (record.date !== date) return;
    writeJson(localKeys.log(date), record.log || {}); writeJson(localKeys.marks(date), record.marks || {}); writeCustomNawafil(date, record.customNawafil || []);
    localStore.setItem(localKeys.driveDayCached(date), new Date().toISOString());
    if (date === dateKey(day)) { setLog(record.log || {}); setMarks(record.marks || {}); setCustomNawafil(record.customNawafil || []); setSyncedMarks(readSynced(date)); }
  }, [driveToken, driveDayFileIds, day, setLog, setMarks, setCustomNawafil, setSyncedMarks]);
  const loadQazaYear = useCallback(async (repository: QazaRepository, year: number): Promise<QazaRecord[]> => {
    if (!driveToken || !driveFileId) return repository.getYear(year);
    const port = createGoogleQazaDrive(driveToken, driveFileId);
    await ensureQazaFiles(port, repository, driveFileId, [year]);
    return downloadQazaYear(port, repository, year);
  }, [driveToken, driveFileId]);
  const requestPrayerSync = (prayerId: string, prayerName: string) => {
    const traceId = globalThis.crypto?.randomUUID?.() || `sync-${Date.now()}`;
    syncTraceId.current = traceId;
    const mark = marks[prayerId];
    const syncedAt = readSynced(dateKey(day))[prayerId];
    console.info("[drive-sync] Sync button clicked", { traceId, prayerId, prayerName, connected: !!driveEmail, hasToken: !!driveToken, hasSummaryFile: !!driveFileId, hydrated: driveHydrated, ready, hasMark: !!mark, dirty: !!mark && mark.changedAt !== syncedAt, pendingChanges: drivePendingChanges });
    if (!driveToken || !driveFileId || !driveHydrated || !mark || mark.changedAt === syncedAt || syncNow) {
      console.warn("[drive-sync] Click ignored: sync prerequisites not met", { traceId, missing: [!driveToken && "access-token", !driveFileId && "summary-file", !driveHydrated && "drive-hydration", !mark && "prayer-mark", !!mark && mark.changedAt === syncedAt && "unsynced-change", syncNow && "sync-already-running"].filter(Boolean) });
      return;
    }
    setSyncPrayerId(prayerId); setDriveStatus(`Syncing ${prayerName} and other pending changes…`); setSyncNow(true);
  };
  return { driveToken, driveFileId, driveDayFileIds, driveEmail, driveStatus, driveAnalysis, driveFetchedDay, driveRefreshUsedToday, drivePendingChanges, driveAuthChecked, syncNow, setSyncNow, setDriveStatus, queueDriveChange, connectGoogleDrive, refreshDriveData, loadDriveDay, loadQazaYear, requestPrayerSync };
}
