"use client";

import { MapPin } from "lucide-react";
import type { DayTimings, MonthTimings } from "@/lib/types";

const prayerNames = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

export function PrayerTimesTab({ timingStatus, todayTimings, monthTimings, cityDraft, countryDraft, methodDraft, onCityChange, onCountryChange, onMethodChange, onSaveLocation, formatTime }: {
  timingStatus: string;
  todayTimings: DayTimings | null;
  monthTimings: MonthTimings | null;
  cityDraft: string;
  countryDraft: string;
  methodDraft: number;
  onCityChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onMethodChange: (value: number) => void;
  onSaveLocation: () => void;
  formatTime: (value?: string, timezone?: string) => string;
}) {
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01T12:00:00`));
  return <div className="tab-content times-tab">
    <header className="tab-heading"><span className="card-kicker">PRAYER SCHEDULE</span><h1>Prayer times</h1><p>Today and the full monthly timetable for your selected location.</p></header>
    <section className="timings-panel" aria-label="Prayer timing location settings">
      <div className="timings-heading"><div className="timings-pin"><MapPin size={15} /></div><div><b>Today’s prayer times</b><span>{timingStatus}{todayTimings?.timezone ? ` · ${todayTimings.timezone}` : ""}</span></div></div>
      <div className="timings-settings"><input aria-label="City" value={cityDraft} onChange={(event) => onCityChange(event.target.value)} placeholder="City" /><input aria-label="Country" value={countryDraft} onChange={(event) => onCountryChange(event.target.value)} placeholder="Country" /><select aria-label="Calculation method" value={methodDraft} onChange={(event) => onMethodChange(Number(event.target.value))}><option value={1}>Karachi method</option><option value={2}>ISNA</option><option value={3}>Muslim World League</option><option value={4}>Umm al-Qura</option><option value={5}>Egyptian</option></select><button className="timings-save" onClick={onSaveLocation}>Save location</button></div>
      <small className="timings-note">Times are cached in this browser. The schedule follows the selected city and calculation method; local mosque timetables may differ.</small>
    </section>
    <section className="monthly-timings-panel" aria-label="Prayer times for the full month">
      <div className="monthly-timings-heading"><div><span className="card-kicker">PLAN AHEAD</span><h2>{monthLabel} prayer timetable</h2></div><span>{monthTimings ? `${monthTimings.location.city}, ${monthTimings.location.country}` : "Monthly schedule unavailable"}</span></div>
      {monthTimings?.days.length ? <div className="monthly-timings-scroll"><table className="monthly-timings-table"><thead><tr><th>Date</th>{prayerNames.map((name) => <th key={name}>{name}</th>)}</tr></thead><tbody>{monthTimings.days.map((entry) => <tr key={entry.date}><th scope="row">{new Date(`${entry.date}T12:00:00`).toLocaleDateString("en", { weekday: "short", day: "numeric" })}</th>{prayerNames.map((name) => <td key={name}>{formatTime(entry.timings[name], entry.timezone)}</td>)}</tr>)}</tbody></table></div> : <p className="monthly-timings-empty">{todayTimings ? "Today’s saved time is available above. The full month will appear after the next allowed schedule request." : timingStatus}</p>}
    </section>
  </div>;
}
