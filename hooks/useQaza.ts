import { useEffect, useState } from "react";
import type { Log, Prayer } from "@/lib/types";
import { addDays, dateKey } from "@/lib/dates";
import { fard } from "@/lib/prayers";
import { localKeys, localStore, logDateFromKey, readJson, writeJson } from "@/lib/storage/local";

export type QazaItem = { id: string; date: string; prayer: Prayer };

export function useQaza(ready: boolean, today: string, viewedDay: string, viewedLog: Log, startDate: string) {
  const [qazaDone, setQazaDone] = useState<string[]>([]);
  const [qazaDoneOn, setQazaDoneOn] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!ready) return;
    const done: unknown = readJson<unknown>(localKeys.qazaDone, []);
    const doneOn: unknown = readJson<unknown>(localKeys.qazaDoneOn, {});
    setQazaDone(Array.isArray(done) ? done.filter((id): id is string => typeof id === "string") : []);
    setQazaDoneOn(doneOn && typeof doneOn === "object" && !Array.isArray(doneOn) ? doneOn as Record<string, string> : {});
  }, [ready]);
  useEffect(() => { if (ready) writeJson(localKeys.qazaDone, qazaDone); }, [qazaDone, ready]);
  useEffect(() => { if (ready) writeJson(localKeys.qazaDoneOn, qazaDoneOn); }, [qazaDoneOn, ready]);

  const readMissedPrayers = (): QazaItem[] => {
    if (typeof window === "undefined") return [];
    const logs: Record<string, Log> = {};
    for (let index = 0; index < localStore.length; index++) {
      const key = localStore.key(index);
      const logDate = logDateFromKey(key);
      if (!logDate || logDate < startDate || logDate >= today) continue;
      const value: unknown = readJson<unknown>(key!, {});
      if (value && typeof value === "object" && !Array.isArray(value)) logs[logDate] = value as Log;
    }
    const missed: QazaItem[] = [];
    let cursor = new Date(`${startDate}T12:00:00`);
    while (dateKey(cursor) < today) {
      const date = dateKey(cursor);
      const dayLog = date === viewedDay ? viewedLog : logs[date] || {};
      for (const prayer of fard) if (!dayLog[prayer.id]) missed.push({ id: `${date}-${prayer.id}`, date, prayer });
      cursor = addDays(cursor, 1);
    }
    return missed;
  };
  const markDone = (id: string) => {
    setQazaDone((current) => current.includes(id) ? current : [...current, id]);
    setQazaDoneOn((current) => ({ ...current, [id]: dateKey(new Date()) }));
  };
  return { qazaDone, setQazaDone, qazaDoneOn, setQazaDoneOn, readMissedPrayers, markDone };
}
