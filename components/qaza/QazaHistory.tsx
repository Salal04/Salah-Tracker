"use client";

import { useEffect, useMemo, useState } from "react";
import { QAZA_PRAYERS, type QazaRecord, type QazaStatus } from "@/lib/qaza/types";
import type { QazaRepository } from "@/lib/qaza/repository";
import { adjustQaza } from "@/lib/qaza/complete";

const PAGE_SIZE = 50;
export function QazaHistory({ repository, refreshKey = 0, onAdjusted, onLoadYear }: { repository: QazaRepository; refreshKey?: number; onAdjusted?: () => void; onLoadYear?: (year: number) => Promise<unknown> }) {
  const [year, setYear] = useState(String(new Date().getFullYear())); const [records, setRecords] = useState<QazaRecord[]>([]);
  const [prayer, setPrayer] = useState("all"); const [status, setStatus] = useState("all"); const [date, setDate] = useState(""); const [search, setSearch] = useState(""); const [page, setPage] = useState(0);
  const [localError, setLocalError] = useState("");
  useEffect(() => { let active = true; const request = year === "undated" ? repository.listAllRecords().then((rows) => rows.filter((r) => r.year === null)) : (onLoadYear ? onLoadYear(Number(year)).then(() => repository.getYear(Number(year))) : repository.getYear(Number(year))); void request.then((rows) => { if (active) setRecords(rows); }).catch(() => { if (active) setLocalError("Could not load this year from Drive. Cached records remain available."); }); return () => { active = false; }; }, [repository, year, refreshKey, onLoadYear]);
  const filtered = useMemo(() => records.filter((r) => (prayer === "all" || r.prayer === prayer) && (status === "all" || r.status === status) && (!date || r.missedDate === date) && (!search || `${r.id} ${r.prayer} ${r.missedDate || "undated"}`.toLowerCase().includes(search.toLowerCase()))), [records, prayer, status, date, search]);
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const adjust = async (r: QazaRecord, reason: "entered_by_mistake" | "completed_by_mistake") => {
    const label = reason === "entered_by_mistake" ? "void this outstanding entry" : "reverse its completion and return it to outstanding";
    if (!window.confirm(`Confirm: ${label}? This will be kept in the audit history.`)) return;
    const before = records; const at = new Date().toISOString();
    setLocalError(""); setRecords(records.map((item) => item.id === r.id ? { ...item, status: reason === "entered_by_mistake" ? "voided" : "outstanding", ...(reason === "completed_by_mistake" ? { completedAt: undefined, offeredAt: undefined, affirmation: undefined } : {}), adjustments: [...(item.adjustments || []), { reason, createdAt: at, operationId: "optimistic" }] } : item));
    try { await adjustQaza(repository, r.id, reason); const updated = year === "undated" ? (await repository.listAllRecords()).filter((item) => item.year === null) : await repository.getYear(Number(year)); setRecords(updated); onAdjusted?.(); }
    catch { setRecords(before); setLocalError("Could not save this correction on your device. The original entry was restored."); }
  };
  return <section className="qaza-subview"><h3>Qaza history</h3><div className="qaza-filters">
    <label>Original year <select value={year} onChange={(e) => { setYear(e.target.value); setPage(0); }}><option value="undated">Unknown year</option>{Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}</select></label>
    <label>Prayer <select value={prayer} onChange={(e) => setPrayer(e.target.value)}><option value="all">All</option>{QAZA_PRAYERS.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
    <label>Status <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{(["outstanding", "completed", "pending_confirmation", "offered", "voided"] as QazaStatus[]).map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label>
    <label>Original missed date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><label>Search <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Prayer or record ID" /></label>
  </div>{visible.map((r) => <article className="qaza-history-record" key={r.id}><b>{r.prayer}</b><span>{r.missedDate || "Unknown date"}</span><span>{r.status.replaceAll("_", " ")}</span>{r.completionHistory?.map((event, i) => <small key={i}>Completed {new Date(event.completedAt).toLocaleDateString()} · {event.affirmation === "oath" ? "With affirmation" : "Without affirmation"}{event.reversedAt ? ` · Reversed ${new Date(event.reversedAt).toLocaleDateString()}` : ""}</small>)}{!r.completionHistory?.length && r.completedAt && <span>Completed {new Date(r.completedAt).toLocaleDateString()} · {r.affirmation === "oath" ? "With affirmation" : "Without affirmation"}</span>}{r.status === "outstanding" && <button onClick={() => void adjust(r, "entered_by_mistake")}>Entered by mistake</button>}{r.status === "completed" && <button onClick={() => void adjust(r, "completed_by_mistake")}>Completed by mistake</button>}</article>)}
  {localError && <p role="alert">{localError}</p>}{!visible.length && <p>No records match these filters.</p>}<div className="qaza-pagination"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>{filtered.length ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}` : "0 records"}</span><button disabled={(page + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage(page + 1)}>Next</button></div></section>;
}
