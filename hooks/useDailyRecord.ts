import { useEffect, useState } from "react";
import type { CustomNafl, DayMarks, DayTimings, Log } from "@/lib/types";
import { addDays, dateKey } from "@/lib/dates";
import { localKeys, readCustomNawafil, readJson, writeCustomNawafil, writeJson } from "@/lib/storage/local";
import { getPrayerWindow, prayerIsOnTime } from "@/lib/timings";
import { reducePrayerMark, type Affirmation } from "@/lib/marks";

const objectValue = <T extends object>(value: unknown): T =>
  value && typeof value === "object" && !Array.isArray(value) ? value as T : {} as T;

export function useDailyRecord(ready: boolean, day: Date, todayTimings: DayTimings | null, monthTimings: { days: DayTimings[] } | null) {
  const [log, setLog] = useState<Log>({});
  const [marks, setMarks] = useState<DayMarks>({});
  const [syncedMarks, setSyncedMarks] = useState<Record<string, string>>({});
  const [customNawafil, setCustomNawafil] = useState<CustomNafl[]>([]);
  const [loadedDay, setLoadedDay] = useState("");
  const dayKey = dateKey(day);

  useEffect(() => {
    if (!ready) return;
    setLog(objectValue<Log>(readJson<unknown>(localKeys.log(dayKey), {})));
    setMarks(objectValue<DayMarks>(readJson<unknown>(localKeys.marks(dayKey), {})));
    setSyncedMarks(objectValue<Record<string, string>>(readJson<unknown>(localKeys.syncedMarks(dayKey), {})));
    setCustomNawafil(readCustomNawafil(dayKey));
    setLoadedDay(dayKey);
  }, [ready, dayKey]);
  useEffect(() => { if (ready && loadedDay === dayKey) writeJson(localKeys.log(dayKey), log); }, [log, dayKey, ready, loadedDay]);
  useEffect(() => { if (ready && loadedDay === dayKey) writeJson(localKeys.marks(dayKey), marks); }, [marks, dayKey, ready, loadedDay]);
  useEffect(() => { if (ready && loadedDay === dayKey) writeCustomNawafil(dayKey, customNawafil); }, [customNawafil, dayKey, ready, loadedDay]);

  const addCustomNafl = (name: string, rakaat?: number) => {
    const cleanName = name.trim().slice(0, 60);
    if (!cleanName) return;
    const id = `custom-nafl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setCustomNawafil((current) => [...current, { id, name: cleanName, ...(rakaat ? { rakaat } : {}) }]);
  };

  const togglePrayer = (id: string, affirmation: Affirmation, queueDriveChange: () => void, onToast: (message: string) => void) => {
    if (dayKey !== dateKey(new Date())) return;
    const wasDone = !!log[id];
    const now = new Date();
    const changedAt = now.toISOString();
    const nextTimingDate = todayTimings ? dateKey(addDays(new Date(`${todayTimings.date}T12:00:00`), 1)) : "";
    const nextDayFajr = monthTimings?.days.find((entry) => entry.date === nextTimingDate)?.timings.Fajr;
    const timingKey = ({ fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" } as Record<string, string>)[id];
    const window = wasDone ? undefined : getPrayerWindow(id, todayTimings, nextDayFajr);
    const next = reducePrayerMark(log, marks, id, { changedAt, markedAt: wasDone ? undefined : changedAt, windowStart: wasDone ? undefined : window?.start.toISOString() ?? null, windowEnd: wasDone ? undefined : window?.end.toISOString() ?? null, onTime: wasDone ? undefined : window ? prayerIsOnTime(id, now, todayTimings, nextDayFajr) === true : false, prayerTime: wasDone ? undefined : timingKey ? todayTimings?.timings[timingKey] : undefined, timezone: wasDone ? undefined : todayTimings?.timezone, timingLocation: wasDone ? undefined : todayTimings?.location }, affirmation);
    setLog(next.log);
    setMarks(next.marks);
    queueDriveChange();
    onToast(wasDone ? "Prayer unmarked" : "Alhamdulillah — logged");
  };

  return { log, setLog, marks, setMarks, syncedMarks, setSyncedMarks, customNawafil, setCustomNawafil, addCustomNafl, loadedDay, togglePrayer };
}
