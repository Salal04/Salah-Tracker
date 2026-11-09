import type { DayMarks, Log, PrayerMark } from "./types";

export type Affirmation = "oath" | "none";

export function getAffirmation(mark: PrayerMark | undefined): Affirmation {
  return mark?.affirmation === "oath" ? "oath" : "none";
}

export function reducePrayerMark(
  log: Log,
  marks: DayMarks,
  id: string,
  mark: Omit<PrayerMark, "completed" | "affirmation">,
  affirmation: Affirmation,
): { log: Log; marks: DayMarks } {
  const completed = !log[id];
  return {
    log: { ...log, [id]: completed },
    marks: {
      ...marks,
      [id]: completed
        ? { ...mark, completed: true, affirmation }
        : {
            changedAt: mark.changedAt,
            completed: false,
            affirmation: "none",
            ...(marks[id]?.windowStart !== undefined ? { windowStart: marks[id].windowStart } : {}),
            ...(marks[id]?.windowEnd !== undefined ? { windowEnd: marks[id].windowEnd } : {}),
          },
    },
  };
}
