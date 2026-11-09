"use client";

import { useState, type FormEvent } from "react";
import { Check, ChevronDown, Sparkles, Upload } from "lucide-react";
import type { CustomNafl, Log, Prayer, PrayerMark } from "@/lib/types";
import { witrPrayer } from "@/lib/prayers";

export function PrayerListSection({ fard, relatedByFard, otherNawafil, customNawafil, log, marks, syncedMarks, isToday, driveEmail, syncNow, onToggle, onSync, onAddCustom }: {
  fard: Prayer[];
  relatedByFard: Record<string, Prayer[]>;
  otherNawafil: Prayer[];
  customNawafil: CustomNafl[];
  log: Log;
  marks: Record<string, PrayerMark>;
  syncedMarks: Record<string, string>;
  isToday: boolean;
  driveEmail: string;
  syncNow: boolean;
  onToggle: (id: string) => void;
  onSync: (prayer: Prayer) => void;
  onAddCustom: (name: string, rakaat?: number) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const done = fard.filter((prayer) => log[prayer.id]).length;
  return <section className="tab-content" id="prayers">
    <div className="section-heading"><div><span className="card-kicker">THE FIVE DAILY PRAYERS</span><h2>Fard salah <span className="count-chip">{done}/5</span></h2></div><span className="section-note">Times are reminders</span></div>
    <div className="prayer-list">{fard.map((prayer, index) => <div className="fard-prayer-group" key={prayer.id}>
      <PrayerRow prayer={prayer} checked={!!log[prayer.id]} disabled={!isToday} mark={marks[prayer.id]} syncedAt={syncedMarks[prayer.id]} driveEmail={driveEmail} syncNow={syncNow} onToggle={() => onToggle(prayer.id)} onSync={() => onSync(prayer)} index={index} expanded={!!expanded[prayer.id]} onExpand={() => setExpanded((current) => ({ ...current, [prayer.id]: !current[prayer.id] }))} />
      {expanded[prayer.id] && <div className="related-prayers">
        <span className="related-prayers-label">Sunnah Muakkadah</span>
        {(relatedByFard[prayer.id] || []).map((related, relatedIndex) => <PrayerRow key={related.id} prayer={related} checked={!!log[related.id]} disabled={!isToday} mark={marks[related.id]} syncedAt={syncedMarks[related.id]} driveEmail={driveEmail} syncNow={syncNow} onToggle={() => onToggle(related.id)} onSync={() => onSync(related)} index={relatedIndex} extra />)}
        {prayer.id === "isha" && <><span className="related-prayers-label witr-label">Witr</span><PrayerRow prayer={witrPrayer} checked={!!log.witr} disabled={!isToday} mark={marks.witr} syncedAt={syncedMarks.witr} driveEmail={driveEmail} syncNow={syncNow} onToggle={() => onToggle(witrPrayer.id)} onSync={() => onSync(witrPrayer)} index={0} extra /></>}
      </div>}
    </div>)}</div>
    <OtherNawafil prayers={otherNawafil.filter((prayer) => prayer.id !== "witr")} customNawafil={customNawafil} log={log} marks={marks} syncedMarks={syncedMarks} isToday={isToday} driveEmail={driveEmail} syncNow={syncNow} onToggle={onToggle} onSync={onSync} onAddCustom={onAddCustom} />
  </section>;
}

function OtherNawafil({ prayers, customNawafil, log, marks, syncedMarks, isToday, driveEmail, syncNow, onToggle, onSync, onAddCustom }: {
  prayers: Prayer[]; customNawafil: CustomNafl[]; log: Log; marks: Record<string, PrayerMark>; syncedMarks: Record<string, string>; isToday: boolean; driveEmail: string; syncNow: boolean; onToggle: (id: string) => void; onSync: (prayer: Prayer) => void; onAddCustom: (name: string, rakaat?: number) => void;
}) {
  const [name, setName] = useState("");
  const [rakaat, setRakaat] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const count = rakaat.trim() ? Number(rakaat) : undefined;
    if (!name.trim() || (count !== undefined && (!Number.isInteger(count) || count < 1 || count > 50))) return;
    onAddCustom(name, count);
    setName(""); setRakaat("");
  };
  const customPrayer = (item: CustomNafl): Prayer => ({ id: item.id, name: item.name, arabic: "", time: "Today", icon: Sparkles, kind: "nafl", rakaat: item.rakaat ? `${item.rakaat} rakʿahs` : "" });
  const all = [...prayers, ...customNawafil.map(customPrayer)];
  return <section className="other-nawafil-section">
    <div className="section-heading"><div><span className="card-kicker">VOLUNTARY PRAYERS</span><h2>Other nawafil <span className="count-chip">{all.filter((prayer) => log[prayer.id]).length}/{all.length}</span></h2></div></div>
    <div className="nawafil-list">{all.map((prayer, index) => <PrayerRow key={prayer.id} prayer={prayer} checked={!!log[prayer.id]} disabled={!isToday} mark={marks[prayer.id]} syncedAt={syncedMarks[prayer.id]} driveEmail={driveEmail} syncNow={syncNow} onToggle={() => onToggle(prayer.id)} onSync={() => onSync(prayer)} index={index} extra />)}</div>
    <form className="custom-nafl-form" onSubmit={submit}>
      <label> Add a nafl for today
        <span className="custom-nafl-inputs"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="Name" disabled={!isToday} required /><input type="number" min="1" max="50" step="1" value={rakaat} onChange={(event) => setRakaat(event.target.value)} placeholder="Rakaat (optional)" aria-label="Rakaat (optional)" disabled={!isToday} /><button type="submit" disabled={!isToday || !name.trim()}>Add</button></span>
      </label>
    </form>
  </section>;
}

function PrayerRow({ prayer, checked, onToggle, onSync, index, extra = false, disabled = false, driveEmail, syncNow, mark, syncedAt, expanded, onExpand }: {
  prayer: Prayer; checked: boolean; onToggle: () => void; onSync: () => void; index: number; extra?: boolean; disabled?: boolean; driveEmail: string; syncNow: boolean; mark?: PrayerMark; syncedAt?: string; expanded?: boolean; onExpand?: () => void;
}) {
  const Icon = prayer.icon;
  const dirty = !!mark && mark.changedAt !== syncedAt;
  const markedLabel = mark?.completed && mark.markedAt ? new Date(mark.markedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  return <div className={`prayer-row ${checked ? "is-checked" : ""} ${extra ? "extra-row" : ""}`} style={{ animationDelay: `${index * 45}ms` }}><div className={`prayer-icon ${prayer.kind}`}><Icon size={18} strokeWidth={1.7} /></div><div className="prayer-name"><b>{prayer.name}</b><span>{prayer.time}</span>{markedLabel && <small className="mark-meta">Marked {markedLabel}</small>}</div>{prayer.arabic && <span className="prayer-arabic" lang="ar" dir="rtl">{prayer.arabic}</span>}<span className="rakaat">{prayer.rakaat}</span>{onExpand && <button className="expand-related-button" type="button" onClick={onExpand} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} related prayers for ${prayer.name}`}><ChevronDown size={16} className={expanded ? "rotated" : ""} /></button>}<button className="sync-prayer-button" onClick={onSync} disabled={!driveEmail || !dirty || syncNow} title={!driveEmail || !dirty || syncNow ? "No unsynced change, or connect Google Drive first" : `Sync ${prayer.name} change to Drive`} aria-label={`Sync ${prayer.name} change to Google Drive`}><Upload size={13} /><span>{!driveEmail ? "Connect" : dirty ? "Sync" : mark ? "Synced" : "Sync"}</span></button><button className={`check-button ${checked ? "checked" : ""}`} onClick={onToggle} disabled={disabled} aria-label={`${disabled ? "View" : checked ? "Unmark" : "Mark"} ${prayer.name} ${extra ? "prayer" : "salah"}`}><Check size={16} /><span>{disabled ? "View only" : checked ? "Done" : "Mark done"}</span></button></div>;
}
