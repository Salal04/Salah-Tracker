export const DRIVE_SYNC_QUOTA = Object.freeze({
  fardSlotsPerDay: 5,
  naflSlotsPerDay: 1,
  fardPrayerIds: ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const,
  resetAtLocalMidnight: true,
  requirePrayerWindowForFard: true,
  ishaWindowEndsAtNextFajr: true,
  debounceMs: 45_000,
});

export type FardPrayerId = (typeof DRIVE_SYNC_QUOTA.fardPrayerIds)[number];
export type SyncSlot =
  | { kind: "fard"; prayerId: string; windowStart?: string | null; windowEnd?: string | null }
  | { kind: "nafl" };

export type SyncQuotaState = {
  day: string;
  fardUsed: FardPrayerId[];
  naflUsed: number;
  legacyUsed: number;
};

export type SyncQuotaFailure = "invalid-prayer" | "prayer-window-closed" | "fard-prayer-already-synced" | "fard-quota-used" | "nafl-quota-used" | "daily-quota-used";
export type SyncQuotaResult =
  | { allowed: true; state: SyncQuotaState }
  | { allowed: false; state: SyncQuotaState; reason: SyncQuotaFailure };

export const localDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const createSyncQuotaState = (day: string, legacyUsed = 0): SyncQuotaState => ({
  day,
  fardUsed: [],
  naflUsed: 0,
  legacyUsed: Math.max(0, Math.min(DRIVE_SYNC_QUOTA.fardSlotsPerDay + DRIVE_SYNC_QUOTA.naflSlotsPerDay, Math.floor(legacyUsed))),
});

export const parseSyncQuotaState = (value: string | null, now: Date, legacyUsed = 0): SyncQuotaState => {
  const day = localDayKey(now);
  if (!value) return createSyncQuotaState(day, legacyUsed);
  try {
    const candidate = JSON.parse(value) as Partial<SyncQuotaState>;
    if (candidate.day !== day) return createSyncQuotaState(day);
    const numericFardUsed = typeof candidate.fardUsed === "number" && Number.isInteger(candidate.fardUsed) ? candidate.fardUsed : 0;
    const fardUsed = Array.isArray(candidate.fardUsed)
      ? [...new Set(candidate.fardUsed.filter((id): id is FardPrayerId => DRIVE_SYNC_QUOTA.fardPrayerIds.includes(id as FardPrayerId)))]
      : DRIVE_SYNC_QUOTA.fardPrayerIds.slice(0, Math.max(0, Math.min(DRIVE_SYNC_QUOTA.fardSlotsPerDay, numericFardUsed)));
    const naflUsed = Number.isInteger(candidate.naflUsed) ? Math.max(0, Math.min(DRIVE_SYNC_QUOTA.naflSlotsPerDay, candidate.naflUsed!)) : 0;
    const persistedLegacy = Number.isInteger(candidate.legacyUsed) ? Math.max(0, candidate.legacyUsed!) : legacyUsed;
    return { day, fardUsed, naflUsed, legacyUsed: Math.min(DRIVE_SYNC_QUOTA.fardSlotsPerDay + DRIVE_SYNC_QUOTA.naflSlotsPerDay, persistedLegacy) };
  } catch {
    return createSyncQuotaState(day, legacyUsed);
  }
};

export const claimSyncQuotaSlot = (state: SyncQuotaState, slot: SyncSlot, now: Date): SyncQuotaResult => {
  const day = localDayKey(now);
  const current = state.day === day ? state : createSyncQuotaState(day);
  const dailyMaximum = DRIVE_SYNC_QUOTA.fardSlotsPerDay + DRIVE_SYNC_QUOTA.naflSlotsPerDay;

  if (slot.kind === "fard") {
    if (!DRIVE_SYNC_QUOTA.fardPrayerIds.includes(slot.prayerId as FardPrayerId)) {
      return { allowed: false, state: current, reason: "invalid-prayer" };
    }
    if (DRIVE_SYNC_QUOTA.requirePrayerWindowForFard) {
      const start = slot.windowStart ? new Date(slot.windowStart) : undefined;
      const end = slot.windowEnd ? new Date(slot.windowEnd) : undefined;
      if (!start || !end || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || now < start || now >= end) {
        return { allowed: false, state: current, reason: "prayer-window-closed" };
      }
    }
    if (current.fardUsed.includes(slot.prayerId as FardPrayerId)) {
      return { allowed: false, state: current, reason: "fard-prayer-already-synced" };
    }
    if (current.fardUsed.length >= DRIVE_SYNC_QUOTA.fardSlotsPerDay) {
      return { allowed: false, state: current, reason: "fard-quota-used" };
    }
    if (current.fardUsed.length + current.naflUsed + current.legacyUsed >= dailyMaximum) {
      return { allowed: false, state: current, reason: "daily-quota-used" };
    }
    return { allowed: true, state: { ...current, fardUsed: [...current.fardUsed, slot.prayerId as FardPrayerId] } };
  }

  if (current.naflUsed >= DRIVE_SYNC_QUOTA.naflSlotsPerDay) {
    return { allowed: false, state: current, reason: "nafl-quota-used" };
  }
  if (current.fardUsed.length + current.naflUsed + current.legacyUsed >= dailyMaximum) {
    return { allowed: false, state: current, reason: "daily-quota-used" };
  }
  return { allowed: true, state: { ...current, naflUsed: current.naflUsed + 1 } };
};

export const claimSyncQuotaSlots = (state: SyncQuotaState, slots: SyncSlot[], now: Date): SyncQuotaResult => {
  let current = state.day === localDayKey(now) ? state : createSyncQuotaState(localDayKey(now));
  for (const slot of slots) {
    const result = claimSyncQuotaSlot(current, slot, now);
    if (!result.allowed) return { allowed: false, state, reason: result.reason };
    current = result.state;
  }
  return { allowed: true, state: current };
};

export const quotaFailureMessage = (reason: SyncQuotaFailure): string => {
  switch (reason) {
    case "invalid-prayer": return "Could not verify this prayer's sync slot. Your changes remain saved on this device.";
    case "prayer-window-closed": return "This prayer's timing window has ended. Your changes remain saved on this device.";
    case "fard-prayer-already-synced": return "This prayer was already synced today and is locked until tomorrow.";
    case "fard-quota-used": return "Today's five fard sync slots are used. Your changes remain saved on this device.";
    case "nafl-quota-used": return "Today's nafl sync slot is used. Other changes remain saved on this device and can sync tomorrow.";
    case "daily-quota-used": return "Today's Drive sync quota is used. Changes remain saved on this device and can sync tomorrow.";
  }
};
