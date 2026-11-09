"use client";

import { ArrowDown, ArrowUp, Check } from "lucide-react";
import type { Prayer } from "@/lib/types";
type QazaItem = { id: string; date: string; prayer: Prayer };

export function QazaTracker({ items, order, limit, onToggleOrder, onMarkDone, onShowMore }: { items: QazaItem[]; order: "oldest" | "newest"; limit: number; onToggleOrder: () => void; onMarkDone: (id: string) => void; onShowMore: () => void }) {
  return <section className="tab-content" id="qaza">
    <div className="section-heading qaza-heading"><div><span className="card-kicker">MAKE UP MISSED FARD PRAYERS</span><h2>Qaza tracker <span className="count-chip qaza-count">{items.length} remaining</span></h2></div><button className="collapse-button" onClick={onToggleOrder} aria-label={`Sort ${order === "oldest" ? "newest first" : "oldest first"}`}>{order === "oldest" ? <ArrowUp size={14} /> : <ArrowDown size={14} />}{order === "oldest" ? "Oldest first" : "Newest first"}</button></div>
    <div className="qaza-summary"><div><b>{items.length === 0 ? "You’re all caught up." : `${items.length} fard ${items.length === 1 ? "prayer" : "prayers"} to make up`}</b><span>Mark a prayer complete to move on to the next one.</span></div><span className="qaza-total">{items.length}</span></div>
    {items.length > 0 && <><div className="qaza-list">{items.slice(0, limit).map((item, index) => <div className="qaza-row" key={item.id}><span className="qaza-number">{index + 1}</span><span className="qaza-prayer"><b>{item.prayer.name}</b><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })} · {item.prayer.rakaat}</small></span><button className="check-button" onClick={() => onMarkDone(item.id)} aria-label={`Mark ${item.prayer.name} from ${item.date} as completed`}><Check size={16} /><span>Qaza done</span></button></div>)}</div>{items.length > limit && <button className="qaza-more" onClick={onShowMore}>Show next 3 prayers</button>}</>}
  </section>;
}
