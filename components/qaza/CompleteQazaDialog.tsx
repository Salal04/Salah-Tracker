"use client";

import { useState } from "react";
import type { QazaAffirmation, QazaRecord } from "@/lib/qaza/types";

export function CompleteQazaDialog({ record, onSave, onClose }: { record: QazaRecord; onSave: (id: string, affirmation: QazaAffirmation) => Promise<unknown>; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [affirmation, setAffirmation] = useState<QazaAffirmation | null>(null);
  const [error, setError] = useState("");
  const save = async () => { if (!affirmation || saving) return; setSaving(true); setError(""); try { await onSave(record.id, affirmation); onClose(); } catch { setError("Could not save on this device. Your change was rolled back; please retry."); } finally { setSaving(false); } };
  return <div className="qaza-dialog-backdrop" role="presentation"><section className="qaza-dialog" role="dialog" aria-modal="true" aria-labelledby="complete-qaza-title">
    <h2 id="complete-qaza-title">Complete Qaza prayer</h2><p><b>{record.prayer[0].toUpperCase() + record.prayer.slice(1)}</b> · Original date: {record.missedDate || "Unknown date"}</p>
    <p>Have you offered this Qaza prayer?</p><div className="qaza-dialog-options"><button type="button" aria-pressed={affirmation === "oath"} onClick={() => setAffirmation("oath")}>With affirmation</button><button type="button" aria-pressed={affirmation === "none"} onClick={() => setAffirmation("none")}>Without affirmation</button></div>
    <small>Affirmation is optional and is not a compulsory oath.</small>{error && <p role="alert">{error}</p>}<div className="qaza-dialog-actions"><button type="button" onClick={onClose}>Cancel</button><button type="button" disabled={!affirmation || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save completion"}</button></div>
  </section></div>;
}
