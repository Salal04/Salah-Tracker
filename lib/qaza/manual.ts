import { DATE_STRING_REGEX } from "../dates";
import { QAZA_PRAYERS, type QazaPrayer, type QazaRecord } from "./types";

export type ManualQazaInput = {
  prayer: QazaPrayer;
  quantity: number;
  missedDate?: string | null;
  year?: number | null;
};

export type ManualQazaGeneratorOptions = {
  now?: Date;
  importId?: string;
  createId?: () => string;
};

const isCalendarDate = (value: string): boolean => {
  if (!DATE_STRING_REGEX.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const newId = (prefix: string): string => {
  const randomId = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2, 12);
  return `${prefix}-${randomId}`;
};

export const generateManualQazaRecords = (
  input: ManualQazaInput,
  options: ManualQazaGeneratorOptions = {},
): QazaRecord[] => {
  if (!QAZA_PRAYERS.includes(input.prayer)) throw new TypeError("Choose one of the five Fard prayers.");
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 5000) {
    throw new RangeError("Quantity must be a whole number between 1 and 5000.");
  }

  const missedDate = input.missedDate ?? null;
  if (missedDate !== null && !isCalendarDate(missedDate)) throw new TypeError("Missed date must be a real YYYY-MM-DD date.");
  const suppliedYear = input.year ?? null;
  if (suppliedYear !== null && (!Number.isInteger(suppliedYear) || suppliedYear < 1 || suppliedYear > 9999)) {
    throw new RangeError("Original year must be between 1 and 9999.");
  }
  if (missedDate && suppliedYear !== null && suppliedYear !== Number(missedDate.slice(0, 4))) {
    throw new RangeError("Original year must match the exact missed date.");
  }

  const now = options.now || new Date();
  if (!Number.isFinite(now.getTime())) throw new TypeError("Detection time must be valid.");
  const importId = options.importId || newId("qaza-import");
  if (!importId.trim()) throw new TypeError("Import ID cannot be empty.");
  const createId = options.createId || (() => newId("qaza"));
  const year = missedDate ? Number(missedDate.slice(0, 4)) : suppliedYear;
  const ids = new Set<string>();

  return Array.from({ length: input.quantity }, () => {
    const id = createId();
    if (!id.trim() || ids.has(id)) throw new Error("Record IDs must be non-empty and unique within an import.");
    ids.add(id);
    return {
      id,
      prayer: input.prayer,
      missedDate,
      detectedAt: now.toISOString(),
      source: "manual",
      status: "outstanding",
      year,
      importId,
    };
  });
};
