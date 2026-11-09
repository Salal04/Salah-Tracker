import { DATE_STRING_REGEX } from "../dates";
import type { QazaRepository } from "./repository";
import type { QazaSetupChoice, QazaSetupState } from "./types";

export const QAZA_SETUP_META_KEY = "qazaSetup";

const isValidDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !DATE_STRING_REGEX.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export const isQazaSetupState = (value: unknown): value is QazaSetupState => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Partial<QazaSetupState>;
  return (state.choice === "no_previous_qaza" || state.choice === "enter_existing_qaza" || state.choice === "add_qaza_later")
    && isValidDate(state.trackingStartDate)
    && typeof state.completedAt === "string"
    && Number.isFinite(Date.parse(state.completedAt));
};

const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const getQazaSetup = async (repository: QazaRepository): Promise<QazaSetupState | null> => {
  const value = await repository.getMeta<unknown>(QAZA_SETUP_META_KEY);
  return isQazaSetupState(value) ? value : null;
};

export const completeQazaSetup = async (
  repository: QazaRepository,
  choice: QazaSetupChoice,
  now = new Date(),
): Promise<QazaSetupState> => {
  const existing = await getQazaSetup(repository);
  if (existing) return existing;

  const state: QazaSetupState = {
    choice,
    trackingStartDate: localDateKey(now),
    completedAt: now.toISOString(),
  };
  await repository.setMeta(QAZA_SETUP_META_KEY, state);
  return state;
};
