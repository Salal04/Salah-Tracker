"use client";

import { useState } from "react";
import type { QazaSetupChoice } from "@/lib/qaza/types";

const choices: { id: QazaSetupChoice; label: string }[] = [
  { id: "no_previous_qaza", label: "I have no previous Qaza" },
  { id: "enter_existing_qaza", label: "I want to enter my existing Qaza" },
  { id: "add_qaza_later", label: "I will add my Qaza later" },
];

export function SetupWizard({ onChoose }: { onChoose: (choice: QazaSetupChoice) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const choose = async (choice: QazaSetupChoice) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try { await onChoose(choice); }
    catch { setError("Your setup could not be saved. Please try again."); setSaving(false); }
  };

  return <div className="qaza-setup-backdrop">
    <section className="qaza-setup-wizard" role="dialog" aria-modal="true" aria-labelledby="qaza-setup-title">
      <span className="card-kicker">FIRST-TIME SETUP</span>
      <h2 id="qaza-setup-title">Set up your Qaza tracker</h2>
      <p>Choose the option that fits you. Automatic Qaza review starts today; earlier days won’t be added automatically.</p>
      <div className="qaza-setup-options">
        {choices.map(({ id, label }) => <button key={id} type="button" disabled={saving} onClick={() => void choose(id)}>{label}</button>)}
      </div>
      {error && <p className="qaza-setup-error" role="alert">{error}</p>}
    </section>
  </div>;
}
