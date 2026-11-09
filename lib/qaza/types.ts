export const QAZA_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

export type QazaPrayer = (typeof QAZA_PRAYERS)[number];
export type QazaSource = "auto" | "manual";
export type QazaStatus = "outstanding" | "completed" | "pending_confirmation" | "offered" | "voided";
export type QazaAffirmation = "oath" | "none";
export type QazaSetupChoice = "no_previous_qaza" | "enter_existing_qaza" | "add_qaza_later";

export type QazaSetupState = {
  choice: QazaSetupChoice;
  trackingStartDate: string;
  completedAt: string;
};

export type QazaRecord = {
  id: string;
  prayer: QazaPrayer;
  missedDate: string | null;
  detectedAt: string;
  source: QazaSource;
  status: QazaStatus;
  offeredAt?: string;
  affirmation?: QazaAffirmation;
  completedAt?: string;
  year: number | null;
  importId?: string;
  completionHistory?: { offeredAt: string; completedAt: string; affirmation: QazaAffirmation; reversedAt?: string }[];
  adjustments?: { reason: "entered_by_mistake" | "completed_by_mistake"; createdAt: string; operationId: string }[];
};

export type QazaOperationType = "ADD_QAZA" | "COMPLETE_QAZA" | "CONFIRM_QAZA" | "CONFIRM_OFFERED" | "CONFIRM_MISSED" | "DEFER_CONFIRMATION" | "ADJUST" | "ADJUST_QAZA";
export type QazaOperationStatus = "pending" | "partial" | "synced" | "failed";

export type QazaOperation = {
  operationId: string;
  type: QazaOperationType;
  recordId: string;
  year: number | null;
  createdAt: string;
  status: QazaOperationStatus;
  record?: QazaRecord;
  previousRecord?: QazaRecord;
  adjustmentReason?: "entered_by_mistake" | "completed_by_mistake";
  attemptCount?: number;
  nextAttemptAt?: string;
  yearWritten?: boolean;
  statisticsWritten?: boolean;
  syncSlot?: { kind: "fard"; prayerId: string; windowStart?: string | null; windowEnd?: string | null } | { kind: "nafl" };
};

export type QazaPrayerStatistics = {
  added: number;
  completed: number;
  outstanding: number;
};

export type QazaYearStatistics = {
  originated: number;
  completed: number;
  outstanding: number;
};

export type QazaStatistics = {
  totalRecords: number;
  totalAdded: number;
  totalCompleted: number;
  totalOutstanding: number;
  completionPercentage: number;
  byPrayer: Record<QazaPrayer, QazaPrayerStatistics>;
  byYear: Record<string, QazaYearStatistics>;
  bySource: Record<QazaSource, number>;
  completedByAffirmation: {
    oath: number;
    none: number;
  };
};
