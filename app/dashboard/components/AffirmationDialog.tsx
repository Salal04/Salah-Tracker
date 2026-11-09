"use client";

import { useEffect } from "react";
import type { Affirmation } from "@/lib/marks";

export function AffirmationDialog({ onChoose, onClose }: {
  onChoose: (affirmation: Affirmation) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="affirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="affirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="affirmation-title" aria-describedby="affirmation-reminder">
        <span className="card-kicker">A MOMENT OF INTENTION</span>
        <h2 id="affirmation-title">Before you mark this prayer</h2>
        <p id="affirmation-reminder">Allah is the Witness over all things. Choose the response that reflects your own intention; making an oath is entirely voluntary.</p>
        <div className="affirmation-actions">
          <button className="affirmation-oath" onClick={() => onChoose("oath")}>Mark with oath (I swear by Allah I prayed)</button>
          <button className="affirmation-none" onClick={() => onChoose("none")}>Mark without oath</button>
        </div>
      </section>
    </div>
  );
}
