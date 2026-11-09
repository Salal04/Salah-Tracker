"use client";

import { CalendarDays, Clock3, Flame, House } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DashboardTab = "today" | "times" | "qaza" | "insights";

const tabs: { id: DashboardTab; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "Today", icon: House },
  { id: "times", label: "Times", icon: Clock3 },
  { id: "qaza", label: "Qaza", icon: CalendarDays },
  { id: "insights", label: "Insights", icon: Flame },
];

export function DashboardTabs({ active, onChange, qazaPendingCount = 0 }: { active: DashboardTab; onChange: (tab: DashboardTab) => void; qazaPendingCount?: number }) {
  return <nav className="dashboard-tabs" aria-label="Dashboard sections">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`dashboard-tab ${active === id ? "active" : ""}`} aria-current={active === id ? "page" : undefined} onClick={() => onChange(id)}><Icon size={17} /><span>{label}</span>{id === "qaza" && qazaPendingCount > 0 && <span className="dashboard-tab-count" aria-label={`${qazaPendingCount} prayers awaiting review`}>{qazaPendingCount}</span>}</button>)}</nav>;
}
