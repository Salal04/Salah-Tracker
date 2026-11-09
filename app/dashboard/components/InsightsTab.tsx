"use client";

import { Flame } from "lucide-react";
import type { Prayer } from "@/lib/types";
type Analysis = { totalPrayers: number; totalFard: number; totalSunnah: number; totalNafl: number; qazaCompleted: number; completeFardDays: number; bestStreakDays: number; bestStreakPrayerId: string | null; bestStreakByPrayer: Record<string, number>; daysWithFard: number };

export function InsightsTab({ analysis, analysisSource, fard, nawafil, streaks }: { analysis: Analysis; analysisSource: string; fard: Prayer[]; nawafil: Prayer[]; streaks: Record<string, number> }) {
  const stats = [
    ["Prayers marked", analysis.totalPrayers, "Fard, sunnah and nafl"],
    ["Fard completed", analysis.totalFard, `${analysis.completeFardDays} complete five-prayer days`],
    ["Sunnah & nafl", analysis.totalSunnah + analysis.totalNafl, `${analysis.totalSunnah} sunnah · ${analysis.totalNafl} nafl`],
    ["Qaza completed", analysis.qazaCompleted, "From your saved Qaza record"],
    ["Days with fard logged", analysis.daysWithFard, "Since your tracker began"],
  ] as const;
  return <section className="tab-content insights-tab">
    <header className="tab-heading"><span className="card-kicker">YOUR JOURNEY</span><h1>Prayer insights</h1><p>Your progress and personal streaks, based on your saved record.</p></header>
    <div className="analysis-panel"><div className="analysis-grid">{stats.map(([label, value, detail]) => <AnalysisStat key={label} label={label} value={value} detail={detail} />)}<AnalysisStat label="Best prayer streak" value={`${analysis.bestStreakDays} ${analysis.bestStreakDays === 1 ? "day" : "days"}`} detail={[...fard, ...nawafil].find((prayer) => prayer.id === analysis.bestStreakPrayerId)?.name || "Your personal best"} highlight /></div><p className="analysis-footnote">{analysisSource}</p></div>
    <div className="section-heading streak-heading"><div><span className="card-kicker">A LITTLE CONSISTENCY, DAY BY DAY</span><h2>Prayer streaks</h2></div></div>
    <div className="streak-panel"><div className="streak-group"><h3>Fard salah</h3><div className="streak-grid">{fard.map((prayer) => <StreakCard key={prayer.id} prayer={prayer} days={streaks[prayer.id] || 0} />)}</div></div><div className="streak-group"><h3>Sunnah & nawafil</h3><div className="streak-grid">{nawafil.map((prayer) => <StreakCard key={prayer.id} prayer={prayer} days={streaks[prayer.id] || 0} />)}</div></div></div>
  </section>;
}

function AnalysisStat({ label, value, detail, highlight = false }: { label: string; value: string | number; detail: string; highlight?: boolean }) {
  return <div className={`analysis-stat ${highlight ? "highlight" : ""}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function StreakCard({ prayer, days }: { prayer: Prayer; days: number }) {
  return <div className="streak-card"><span className="streak-flame"><Flame size={15} /></span><div><b>{prayer.name}</b><span>{days} {days === 1 ? "day" : "days"}</span></div><span className="streak-status">{days > 0 ? "Personal best" : "Start today"}</span></div>;
}
