"use client";

import { useMemo, useState } from "react";
import type { QazaRecord } from "@/lib/qaza/types";
import type { QazaReviewAnswer } from "@/lib/qaza/review";

const prayerName: Record<QazaRecord["prayer"], string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export function ReviewQueue({ records, onAnswer }: {
  records: QazaRecord[];
  onAnswer: (recordId: string, answer: QazaReviewAnswer) => Promise<QazaRecord>;
}) {
  const [resolvedOptimistically, setResolvedOptimistically] = useState<Set<string>>(() => new Set());
  const [deferredOptimistically, setDeferredOptimistically] = useState<Set<string>>(() => new Set());
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState("");
  const queue = useMemo(() => records
    .filter((record) => record.status === "pending_confirmation" && !resolvedOptimistically.has(record.id) && !deferredOptimistically.has(record.id))
    .sort((a, b) => (a.missedDate || "").localeCompare(b.missedDate || "") || a.id.localeCompare(b.id)),
  [records, resolvedOptimistically, deferredOptimistically]);
  const current = queue[0];

  const choose = async (answer: QazaReviewAnswer) => {
    if (!current || answering) return;
    const recordId = current.id;
    setError("");
    setAnswering(true);
    if (answer === "not_sure") setDeferredOptimistically((ids) => new Set(ids).add(recordId));
    else setResolvedOptimistically((ids) => new Set(ids).add(recordId));
    try {
      await onAnswer(recordId, answer);
    } catch {
      if (answer === "not_sure") setDeferredOptimistically((ids) => { const next = new Set(ids); next.delete(recordId); return next; });
      else setResolvedOptimistically((ids) => { const next = new Set(ids); next.delete(recordId); return next; });
      setError("Your answer could not be saved. Please try again.");
    } finally {
      setAnswering(false);
    }
  };

  return <section className="qaza-review-queue" aria-labelledby="qaza-review-title">
    <div className="qaza-review-heading">
      <div><span className="card-kicker">PRAYER HISTORY REVIEW</span><h2 id="qaza-review-title">Review missed prayers</h2></div>
      <span className="count-chip">{records.length} to review</span>
    </div>
    {current ? <article className="qaza-review-card" aria-busy={answering}>
      <span className="qaza-review-prayer">{prayerName[current.prayer]}</span>
      {current.missedDate && <time className="qaza-review-date" dateTime={current.missedDate}>{new Date(`${current.missedDate}T12:00:00`).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</time>}
      <p className="qaza-review-question">Did you offer this prayer?</p>
      <div className="qaza-review-actions">
        <button className="qaza-review-answer yes" type="button" disabled={answering} onClick={() => void choose("yes")}>Yes, I offered it</button>
        <button className="qaza-review-answer no" type="button" disabled={answering} onClick={() => void choose("no")}>No, I missed it</button>
        <button className="qaza-review-answer unsure" type="button" disabled={answering} onClick={() => void choose("not_sure")}>Not sure</button>
      </div>
    </article> : <p className="qaza-review-empty" aria-live="polite">{records.length ? "You reviewed the current list. Any “Not sure” answers remain pending." : "No prayers are waiting for review."}</p>}
    {error && <p className="qaza-review-error" role="alert">{error}</p>}
  </section>;
}
