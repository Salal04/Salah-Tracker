"use client";

import type { CSSProperties } from "react";
import { ArrowUpRight, Flame } from "lucide-react";

export function DailyOverview({ doneFard, progress }: { doneFard: number; progress: number }) {
  return <div className="overview-grid"><div className="progress-card"><div className="card-top"><div><span className="card-kicker">FARD PRAYERS</span><h2>Your daily salah</h2></div><span className="soft-tag">Obligatory</span></div><div className="progress-content"><div className="ring" style={{ "--progress": `${progress}%` } as CSSProperties}><div className="ring-inner"><strong>{doneFard}<span> / 5</span></strong><small>completed</small></div></div><div className="progress-copy"><b>{doneFard === 5 ? "All five, mashaAllah." : doneFard === 0 ? "A fresh start awaits." : `${5 - doneFard} more to go today.`}</b><span>Every salah is a moment to return.</span><div className="mini-progress"><span style={{ width: `${progress}%` }} /></div><small>{progress}% of your daily prayers</small></div></div></div><div className="insight-card"><div className="insight-icon"><Flame size={18} /></div><span className="card-kicker">YOUR MOMENTUM</span><div className="insight-value">{doneFard}<span> / 5</span></div><p>prayers logged today</p><div className="insight-foot"><span className="trend-icon"><ArrowUpRight size={14} /></span> One prayer at a time</div><div className="insight-decoration">&bull;</div></div></div>;
}
