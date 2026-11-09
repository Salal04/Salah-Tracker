"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { QAZA_PRAYERS, type QazaRecord, type QazaStatistics } from "@/lib/qaza/types";
import type { QazaRepository } from "@/lib/qaza/repository";
import { buildStatistics } from "@/lib/qaza/stats";
import { getSuggestedQaza } from "@/lib/qaza/dashboard";
import { CompleteQazaDialog } from "@/components/qaza/CompleteQazaDialog";
import { QazaHistory } from "@/components/qaza/QazaHistory";

export function QazaTracker({ repository, refreshKey, onComplete }: { repository: QazaRepository; refreshKey: number; onComplete: (id: string, affirmation: "oath" | "none") => Promise<unknown> }) {
  const [records, setRecords] = useState<QazaRecord[]>([]); const [stats, setStats] = useState<QazaStatistics | null>(null);
  const [selectedPrayer, setSelectedPrayer] = useState<string>("fajr"); const [selectedRecord, setSelectedRecord] = useState<QazaRecord | null>(null); const [view, setView] = useState<"overview" | "history" | "statistics">("overview");
  const reload = useCallback(async () => { const all = await repository.listAllRecords(); setRecords(all); const next = buildStatistics([all]); await repository.putStatistics(next); setStats(next); }, [repository]);
  useEffect(() => {
    let active = true;
    void repository.listAllRecords().then(async (all) => {
      const next = buildStatistics([all]); await repository.putStatistics(next);
      if (active) { setRecords(all); setStats(next); }
    });
    return () => { active = false; };
  }, [repository, refreshKey]);
  const outstanding = useMemo(() => records.filter((r) => r.status === "outstanding"), [records]);
  const suggestions = useMemo(() => getSuggestedQaza(outstanding, 3), [outstanding]);
  const selected = outstanding.filter((r) => r.prayer === selectedPrayer);
  const prayerName = (p: string) => p[0].toUpperCase() + p.slice(1);
  return <section className="tab-content" id="qaza">
    <div className="section-heading qaza-heading"><div><span className="card-kicker">PERSONAL PRAYER TRACKER</span><h2>Qaza tracker <span className="count-chip qaza-count">{stats?.totalOutstanding || 0} remaining</span></h2></div></div>
    <p className="qaza-personal-note">A personal tracking tool, not a source of religious rulings.</p>
    <nav className="qaza-subtabs" aria-label="Qaza sections">{(["overview", "history", "statistics"] as const).map((tab) => <button key={tab} aria-pressed={view === tab} onClick={() => setView(tab)}>{tab === "statistics" ? "Statistics" : prayerName(tab)}</button>)}</nav>
    {view === "overview" && <>
      <div className="qaza-metric-grid">{[[stats?.totalAdded ?? 0, "Added"], [stats?.totalCompleted ?? 0, "Completed"], [stats?.totalOutstanding ?? 0, "Outstanding"], [stats?.totalRecords ?? 0, "Records"], [`${(stats?.completionPercentage ?? 0).toFixed(1)}%`, "Completion"]].map(([n, label]) => <div className="qaza-metric" key={String(label)}><b>{n}</b><span>{label}</span></div>)}</div>
      <h3>Outstanding by prayer</h3><div className="qaza-prayer-balance">{QAZA_PRAYERS.map((p) => <button key={p} aria-pressed={selectedPrayer === p} onClick={() => setSelectedPrayer(p)}><span>{prayerName(p)}</span><b>{stats?.byPrayer[p].outstanding ?? 0}</b></button>)}</div>
      <h3>Suggested prayers</h3>{suggestions.length ? suggestions.map((r, i) => <article className="qaza-row" key={r.id}><span className="qaza-number">{i + 1}</span><span className="qaza-prayer"><b>{prayerName(r.prayer)}</b><small>{r.missedDate || "Unknown original date"}</small></span><button className="check-button" onClick={() => setSelectedRecord(r)}><Check size={16} /><span>Complete</span></button></article>) : <p>You’re all caught up.</p>}
      <h3>{prayerName(selectedPrayer)} outstanding records</h3>{selected.map((r) => <article className="qaza-history-record" key={r.id}><span>{r.missedDate || "Unknown date"}</span><small>{r.id}</small><button onClick={() => setSelectedRecord(r)}>Complete</button></article>)}{!selected.length && <p>No outstanding {prayerName(selectedPrayer)} records.</p>}
    </>}
    {view === "history" && <QazaHistory repository={repository} refreshKey={refreshKey} onAdjusted={() => { void reload(); }} />}
    {view === "statistics" && <><h3>Overall statistics</h3><p>Added {stats?.totalAdded ?? 0} · Completed {stats?.totalCompleted ?? 0} · Outstanding {stats?.totalOutstanding ?? 0} · {stats?.completionPercentage.toFixed(1) ?? "0.0"}% complete</p><table className="qaza-statistics-table"><thead><tr><th>Prayer</th><th>Added</th><th>Completed</th><th>Remaining</th></tr></thead><tbody>{QAZA_PRAYERS.map((p) => <tr key={p}><th>{prayerName(p)}</th><td>{stats?.byPrayer[p].added ?? 0}</td><td>{stats?.byPrayer[p].completed ?? 0}</td><td>{stats?.byPrayer[p].outstanding ?? 0}</td></tr>)}</tbody></table><h3>By year</h3>{Object.entries(stats?.byYear || {}).sort(([a], [b]) => a.localeCompare(b)).map(([year, row]) => <p key={year}>{year}: originated {row.originated}, completed {row.completed} during year, remaining {row.outstanding}</p>)}<p>Added manually {stats?.bySource.manual ?? 0} · detected {stats?.bySource.auto ?? 0} · completed with affirmation {stats?.completedByAffirmation.oath ?? 0} · without {stats?.completedByAffirmation.none ?? 0}</p></>}
    {selectedRecord && <CompleteQazaDialog record={selectedRecord} onSave={onComplete} onClose={() => setSelectedRecord(null)} />}
  </section>;
}
