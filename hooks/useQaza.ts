import { useEffect, useState } from "react";
import type { DayTimings, Log, MonthTimings, Prayer } from "@/lib/types";
import { fard } from "@/lib/prayers";
import { localKeys, localStore, logDateFromKey, readJson, writeJson } from "@/lib/storage/local";
import { createIndexedDbQazaRepository } from "@/lib/qaza/repository";
import { detectMissedFardPrayers } from "@/lib/qaza/detect";
import { answerQazaReview, type QazaReviewAnswer } from "@/lib/qaza/review";
import { completeQazaSetup, getQazaSetup } from "@/lib/qaza/setup";
import { completeQaza as completeQazaRecord } from "@/lib/qaza/complete";
import { reconcile } from "@/lib/qaza/stats";
import type { QazaRecord, QazaSetupChoice, QazaSetupState } from "@/lib/qaza/types";

export type QazaItem = { id: string; date: string; prayer: Prayer };

const toItem = (record: QazaRecord): QazaItem | null => {
  if (!record.missedDate) return null;
  const prayer = fard.find((candidate) => candidate.id === record.prayer);
  return prayer ? { id: record.id, date: record.missedDate, prayer } : null;
};

const isWithinQazaTrackingPeriod = (record: QazaRecord, trackingStartDate: string): boolean =>
  record.source !== "auto" || !record.missedDate || record.missedDate >= trackingStartDate;

export function useQaza(ready: boolean, today: string, todayTimings: DayTimings | null, monthTimings: MonthTimings | null) {
  const [qazaDone, setQazaDone] = useState<string[]>([]);
  const [qazaDoneOn, setQazaDoneOn] = useState<Record<string, string>>({});
  const [outstandingQaza, setOutstandingQaza] = useState<QazaItem[]>([]);
  const [pendingConfirmations, setPendingConfirmations] = useState<QazaRecord[]>([]);
  const [setup, setSetup] = useState<QazaSetupState | null>(null);
  const [setupLoaded, setSetupLoaded] = useState(false);
  const [repository] = useState(() => createIndexedDbQazaRepository());
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!ready) return;
    const done: unknown = readJson<unknown>(localKeys.qazaDone, []);
    const doneOn: unknown = readJson<unknown>(localKeys.qazaDoneOn, {});
    setQazaDone(Array.isArray(done) ? done.filter((id): id is string => typeof id === "string") : []);
    setQazaDoneOn(doneOn && typeof doneOn === "object" && !Array.isArray(doneOn) ? doneOn as Record<string, string> : {});
  }, [ready]);
  useEffect(() => { if (ready) writeJson(localKeys.qazaDone, qazaDone); }, [qazaDone, ready]);
  useEffect(() => { if (ready) writeJson(localKeys.qazaDoneOn, qazaDoneOn); }, [qazaDoneOn, ready]);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    let active = true;
    void getQazaSetup(repository).then((savedSetup) => {
      if (active) { setSetup(savedSetup); setSetupLoaded(true); }
    }).catch(() => {
      if (active) setSetupLoaded(true);
    });
    return () => { active = false; };
  }, [ready, repository]);

  useEffect(() => {
    if (!ready || !setupLoaded || !setup || typeof window === "undefined" || setup.trackingStartDate >= today) return;
    let active = true;
    const logs: Record<string, Log> = {};
    for (let index = 0; index < localStore.length; index++) {
      const key = localStore.key(index);
      const logDate = logDateFromKey(key);
      if (!key || !logDate || logDate < setup.trackingStartDate || logDate >= today) continue;
      const value: unknown = readJson<unknown>(key, {});
      if (value && typeof value === "object" && !Array.isArray(value)) logs[logDate] = value as Log;
    }
    const nextFajrAt = monthTimings?.days.find((entry) => entry.date === today)?.timings.Fajr
      || (todayTimings?.date === today ? todayTimings.timings.Fajr : null);

    void (async () => {
      const detected = await detectMissedFardPrayers({ startDate: setup.trackingStartDate, today, logs, nextFajrAt, repository });
      const [outstanding, pending] = await Promise.all([repository.listOutstanding(), repository.listPendingConfirmation()]);
      if (active) {
        if (detected.length) setRefreshKey((value) => value + 1);
        setOutstandingQaza(outstanding.filter((record) => isWithinQazaTrackingPeriod(record, setup.trackingStartDate)).map(toItem).filter((item): item is QazaItem => item !== null));
        setPendingConfirmations(pending.filter((record) => isWithinQazaTrackingPeriod(record, setup.trackingStartDate)));
      }
    })().catch(() => {
      // Keep Qaza data private; storage failures should not log record contents.
    });
    return () => { active = false; };
  }, [ready, today, setupLoaded, setup, todayTimings, monthTimings, repository]);

  const saveSetup = async (choice: QazaSetupChoice): Promise<QazaSetupState> => {
    const saved = await completeQazaSetup(repository, choice);
    setSetup(saved);
    setSetupLoaded(true);
    return saved;
  };

  const answerReview = async (recordId: string, answer: QazaReviewAnswer): Promise<QazaRecord> => {
    const previousPending = pendingConfirmations;
    const previousOutstanding = outstandingQaza;
    const reviewedRecord = previousPending.find((record) => record.id === recordId);
    if (answer !== "not_sure") setPendingConfirmations((current) => current.filter((record) => record.id !== recordId));
    if (answer === "no" && reviewedRecord) {
      const item = toItem({ ...reviewedRecord, status: "outstanding" });
      if (item) setOutstandingQaza((current) => current.some((existing) => existing.id === item.id) ? current : [...current, item]);
    }
    try {
      const updated = await answerQazaReview(repository, recordId, answer);
      await reconcile(repository);
      setRefreshKey((value) => value + 1);
      const [pending, outstanding] = await Promise.all([repository.listPendingConfirmation(), repository.listOutstanding()]);
      setPendingConfirmations(setup ? pending.filter((record) => isWithinQazaTrackingPeriod(record, setup.trackingStartDate)) : []);
      setOutstandingQaza(setup ? outstanding.filter((record) => isWithinQazaTrackingPeriod(record, setup.trackingStartDate)).map(toItem).filter((item): item is QazaItem => item !== null) : []);
      return updated;
    } catch (error) {
      setPendingConfirmations(previousPending);
      setOutstandingQaza(previousOutstanding);
      throw error;
    }
  };

  const markDone = (id: string) => {
    const completedAt = new Date().toISOString();
    setQazaDone((current) => current.includes(id) ? current : [...current, id]);
    setQazaDoneOn((current) => ({ ...current, [id]: completedAt.slice(0, 10) }));
    void (async () => {
      const record = await repository.getById(id);
      if (!record || record.status !== "outstanding") return;
      await repository.addOperation({
        operationId: `complete-${id}-${completedAt}`,
        type: "COMPLETE_QAZA",
        recordId: id,
        year: record.year,
        createdAt: completedAt,
        status: "pending",
      });
      await repository.putRecords([{ ...record, status: "completed", offeredAt: completedAt, completedAt }]);
      setOutstandingQaza((current) => current.filter((item) => item.id !== id));
    })().catch(() => {
      // Keep Qaza data private; storage failures should not log record contents.
    });
  };

  const complete = async (id: string, affirmation: "oath" | "none") => {
    const updated = await completeQazaRecord(repository, id, affirmation);
    setRefreshKey((value) => value + 1);
    if (updated?.status === "completed") setOutstandingQaza((current) => current.filter((item) => item.id !== id));
    return updated;
  };

  return { qazaDone, setQazaDone, qazaDoneOn, setQazaDoneOn, outstandingQaza, pendingConfirmations, setup, setupLoaded, saveSetup, answerReview, markDone, complete, repository, refreshKey };
}
