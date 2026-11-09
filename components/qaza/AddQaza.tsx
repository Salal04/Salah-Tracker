"use client";

import { useState, type FormEvent } from "react";
import { generateManualQazaRecords } from "@/lib/qaza/manual";
import { QAZA_PRAYERS, type QazaPrayer, type QazaRecord } from "@/lib/qaza/types";

const prayerLabels: Record<QazaPrayer, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export function AddQaza({ onSave }: { onSave: (records: QazaRecord[]) => Promise<void> }) {
  const [prayer, setPrayer] = useState<QazaPrayer>("fajr");
  const [quantity, setQuantity] = useState("1");
  const [dateKnown, setDateKnown] = useState(false);
  const [missedDate, setMissedDate] = useState("");
  const [year, setYear] = useState("");
  const [records, setRecords] = useState<QazaRecord[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);

  const review = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      const parsedQuantity = Number(quantity);
      if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 5000) {
        throw new RangeError("Enter a whole number from 1 to 5000.");
      }
      if (dateKnown && !missedDate) throw new TypeError("Choose the exact missed date, or select Unknown date.");
      const parsedYear = year.trim() ? Number(year) : null;
      if (parsedYear !== null && !Number.isInteger(parsedYear)) throw new RangeError("Enter a valid original year.");
      const generated = generateManualQazaRecords({
        prayer,
        quantity: parsedQuantity,
        missedDate: dateKnown ? missedDate : null,
        year: dateKnown ? (missedDate ? Number(missedDate.slice(0, 4)) : null) : parsedYear,
      });
      setRecords(generated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not prepare these Qaza records.");
    }
  };

  const save = async () => {
    if (!records || saving) return;
    setSaving(true);
    setError("");
    setSavedCount(records.length);
    try {
      await onSave(records);
      setSavedCount(records.length);
      setRecords(null);
      setQuantity("1");
      setMissedDate("");
      setYear("");
      setDateKnown(false);
    } catch {
      setSavedCount(0);
      setError("Your Qaza records could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="add-qaza-panel" aria-labelledby="add-qaza-title">
    <div className="section-heading"><div><span className="card-kicker">MANUAL BACKLOG</span><h2 id="add-qaza-title">Add existing Qaza</h2></div></div>
    {records ? <div className="add-qaza-review" aria-live="polite">
      <span className="count-chip">Review before saving</span>
      <h3>Import summary</h3>
      <dl>
        <div><dt>Prayer</dt><dd>{prayerLabels[records[0].prayer]}</dd></div>
        <div><dt>Individual records</dt><dd>{records.length}</dd></div>
        <div><dt>Missed date</dt><dd>{records[0].missedDate || "Unknown date (undated backlog)"}</dd></div>
        <div><dt>Original year</dt><dd>{records[0].year ?? "Not specified"}</dd></div>
        <div><dt>Import group</dt><dd>All records share one import ID</dd></div>
      </dl>
      <div className="add-qaza-actions"><button type="button" className="collapse-button" disabled={saving} onClick={() => setRecords(null)}>Back to edit</button><button type="button" className="add-qaza-save" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : `Save ${records.length} records`}</button></div>
    </div> : <form className="add-qaza-form" onSubmit={review}>
      <label>Prayer<select value={prayer} onChange={(event) => setPrayer(event.target.value as QazaPrayer)}>{QAZA_PRAYERS.map((id) => <option key={id} value={id}>{prayerLabels[id]}</option>)}</select></label>
      <label>Quantity<input type="number" min="1" max="5000" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
      <fieldset><legend>Missed date</legend>
        <label className="add-qaza-radio"><input type="radio" name="missed-date" checked={!dateKnown} onChange={() => setDateKnown(false)} />Unknown date — add as an undated backlog</label>
        <label className="add-qaza-radio"><input type="radio" name="missed-date" checked={dateKnown} onChange={() => setDateKnown(true)} />I know the exact date</label>
        {dateKnown && <label>Exact missed date<input type="date" value={missedDate} onChange={(event) => setMissedDate(event.target.value)} required /></label>}
      </fieldset>
      {!dateKnown && <label>Original year <span className="add-qaza-optional">Optional</span><input type="number" min="1" max="9999" step="1" value={year} onChange={(event) => setYear(event.target.value)} placeholder="Leave blank if unknown" /></label>}
      {dateKnown && missedDate && <p className="add-qaza-derived-year">Original year: {missedDate.slice(0, 4)} (from the date you entered)</p>}
      {error && <p className="add-qaza-error" role="alert">{error}</p>}
      <button className="add-qaza-save" type="submit">Review before saving</button>
    </form>}
    {records && error && <p className="add-qaza-error" role="alert">{error}</p>}
    {savedCount > 0 && <p className="add-qaza-success" role="status">{saving ? `Adding ${savedCount} records to your local Qaza list…` : `Added ${savedCount} individual outstanding Qaza records.`}</p>}
  </section>;
}
