"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, ExternalLink, Heart, House, LayoutDashboard, Moon, RefreshCw } from "lucide-react";
import Link from "next/link";
import { DashboardTabs, type DashboardTab } from "./components/DashboardTabs";
import { DailyOverview } from "./components/DailyOverview";
import { InsightsTab } from "./components/InsightsTab";
import { PrayerListSection } from "./components/PrayerListSection";
import { PrayerTimesTab } from "./components/PrayerTimesTab";
import { QazaTracker } from "./components/QazaTracker";
import { ReviewQueue } from "@/components/qaza/ReviewQueue";
import { SetupWizard } from "@/components/qaza/SetupWizard";
import { ProfileEditor } from "./components/ProfileEditor";
import { SignIn } from "./components/SignIn";
import { AffirmationDialog } from "./components/AffirmationDialog";
import { FeatureRequestForm } from "./components/FeatureRequestForm";
import type { Log, PrayerLocation, UserProfile } from "@/lib/types";
import { addDays, dateKey } from "@/lib/dates";
import { fard, nawafil, otherNawafil, sunnahMuakkadahByFard } from "@/lib/prayers";
import { localKeys, localStore, logDateFromKey, readAllCustomNawafil, readJson, writeJson } from "@/lib/storage/local";
import { calculatePrayerStreaks, calculateTrackerAnalysis } from "@/lib/analysis";
import { normalizeUserProfile } from "@/lib/profile";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useDailyRecord } from "@/hooks/useDailyRecord";
import { useQaza } from "@/hooks/useQaza";
import { useDriveSync } from "@/hooks/useDriveSync";
import { useRouter } from "next/navigation";
import type { QazaSetupChoice } from "@/lib/qaza/types";
import { createGoogleQazaDrive, createQazaQueueWorker } from "@/lib/drive/qaza";
import { processSyncQueue, resumeQueueOnOnline } from "@/lib/sync/queue";
import { recoverQazaSync, repairQazaData } from "@/lib/sync/recover";
const defaultLocation: PrayerLocation = { city: "Karachi", country: "Pakistan", method: 1 };
const formatPrayerTime = (value?: string, timezone?: string) => {
  if (!value) return "Time unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  try { return new Intl.DateTimeFormat([], { ...(timezone ? { timeZone: timezone } : {}), hour: "numeric", minute: "2-digit" }).format(parsed); }
  catch { return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
};
const readUserProfile = (): UserProfile | null => {
  return normalizeUserProfile(readJson<unknown>(localKeys.userProfile, null));
};
const readSavedLogs = (): Record<string, Log> => {
  const logs: Record<string, Log> = {};
  if (typeof window === "undefined") return logs;
  for (const key of Array.from({ length: localStore.length }, (_, index) => localStore.key(index))) {
    const logDate = logDateFromKey(key);
    if (!logDate || !key) continue;
    const value: unknown = readJson<unknown>(key, {});
    if (value && typeof value === "object" && !Array.isArray(value)) logs[logDate] = value as Log;
  }
  return logs;
};
export default function Home() {
  const router = useRouter();
  const [day, setDay] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<DashboardTab>("today");
  const [profile, setProfile] = useState<UserProfile>({ name: "", image: "" });
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [syncQueuePulse, setSyncQueuePulse] = useState(0);
  const [affirmationPrayer, setAffirmationPrayer] = useState<string | null>(null);
  const [location, setLocation] = useState<PrayerLocation>(defaultLocation);
  const [cityDraft, setCityDraft] = useState(defaultLocation.city);
  const [countryDraft, setCountryDraft] = useState(defaultLocation.country);
  const [methodDraft, setMethodDraft] = useState(defaultLocation.method);
  const { todayTimings, monthTimings, timingStatus, setTimingStatus } = usePrayerTimes(ready, day, location);
  const daily = useDailyRecord(ready, day, todayTimings, monthTimings);
  const { log, setLog, marks, setMarks, syncedMarks, setSyncedMarks, customNawafil, addCustomNafl, togglePrayer } = daily;
  const qaza = useQaza(ready, dateKey(new Date()), todayTimings, monthTimings);
  const { qazaDone, setQazaDone, qazaDoneOn, setQazaDoneOn } = qaza;
  const drive = useDriveSync({ ready, day, startDate, setStartDate, prayerLocation: location, log, marks, customNawafil, qazaDone, qazaDoneOn, setProfile, setLog, setMarks, setCustomNawafil: daily.setCustomNawafil, setSyncedMarks, setQazaDone, setQazaDoneOn });
  const { driveToken, driveFileId, driveDayFileIds, driveEmail, driveStatus, driveAnalysis, driveFetchedDay, driveRefreshUsedToday, drivePendingChanges, driveAuthChecked, syncNow, queueDriveChange, connectGoogleDrive, refreshDriveData, loadDriveDay, loadQazaYear, requestPrayerSync } = drive;
  useEffect(() => { if (driveToken) void loadDriveDay(dateKey(day)).catch(() => setToast("This day is still available locally; Drive could not refresh it.")); }, [driveToken, driveDayFileIds, day, loadDriveDay]);
  useEffect(() => {
    if (!ready || !driveToken || !driveFileId) return;
    let active = true; let retryTimer = 0;
    const port = createGoogleQazaDrive(driveToken, driveFileId);
    const worker = createQazaQueueWorker(port, qaza.repository, driveFileId);
    const run = async () => {
      if (!navigator.onLine) return;
      try {
        const recovery = await recoverQazaSync(qaza.repository, worker);
        if (active && (recovery.recovered.length || recovery.statisticsRebuilt)) setSyncQueuePulse((value) => value + 1);
        const result = await processSyncQueue(qaza.repository, worker, { isOnline: () => navigator.onLine, onWaiting: () => undefined });
        if (!active) return;
        if (result.waiting.length) setToast("Qaza changes are saved on this device and waiting to sync.");
        if (result.synced.length) { setToast("Qaza data synced to Drive."); setSyncQueuePulse((value) => value + 1); }
        const queued = [...await qaza.repository.listPendingOperations(), ...await qaza.repository.listPartialOperations()];
        const next = queued.map((operation) => operation.nextAttemptAt ? Date.parse(operation.nextAttemptAt) : Date.now() + 1000).sort((a, b) => a - b)[0];
        if (next) retryTimer = window.setTimeout(() => void run(), Math.max(500, next - Date.now()));
      } catch { if (active) setToast("Qaza data is saved locally; Drive sync will retry when available."); }
    };
    void run();
    const stopOnline = resumeQueueOnOnline(() => void run());
    return () => { active = false; stopOnline(); window.clearTimeout(retryTimer); };
  }, [ready, driveToken, driveFileId, qaza.repository, qaza.refreshKey]);
  useEffect(() => {
    const today = dateKey(new Date());
    let firstSavedDay = "";
    for (let index = 0; index < localStore.length; index++) {
      const logDate = logDateFromKey(localStore.key(index));
      if (logDate && logDate <= today && (!firstSavedDay || logDate < firstSavedDay)) firstSavedDay = logDate;
    }
    const storedStart = localStore.getItem(localKeys.startDate) || firstSavedDay || today;
    let storedLocation = defaultLocation;
    try {
      const parsed = readJson<Partial<PrayerLocation> | null>(localKeys.prayerLocation, null);
      if (parsed?.city && parsed?.country && Number.isFinite(parsed.method)) storedLocation = { city: parsed.city, country: parsed.country, method: parsed.method! };
    } catch { /* Use the default location if settings are malformed. */ }
    localStore.setItem(localKeys.startDate, storedStart);
    setStartDate(storedStart);
    setLocation(storedLocation); setCityDraft(storedLocation.city); setCountryDraft(storedLocation.country); setMethodDraft(storedLocation.method);
    const savedProfile = readUserProfile();
    if (savedProfile) {
      const linkedProfile = { ...savedProfile, location: { city: storedLocation.city, country: storedLocation.country } };
      setProfile(linkedProfile);
      if (savedProfile.location?.city !== storedLocation.city || savedProfile.location?.country !== storedLocation.country) {
        writeJson(localKeys.userProfile, linkedProfile);
        if (localStore.getItem(localKeys.driveEmail) && localStore.getItem(localKeys.driveFileId)) {
          const pending = (Number(localStore.getItem(localKeys.drivePendingChanges)) || 0) + 1;
          localStore.setItem(localKeys.drivePendingChanges, String(pending));
        }
      }
    } else setProfile({ name: "", image: "", location: { city: storedLocation.city, country: storedLocation.country } });
    setReady(true);
  }, [day]);
  useEffect(() => {
    if (ready && driveAuthChecked && !driveToken) window.location.replace("/sign-in");
  }, [ready, driveAuthChecked, driveToken]);

  const doneFard = fard.filter((p) => log[p.id]).length;
  const progress = Math.round((doneFard / fard.length) * 100);
  const activeTabLabel = ({ today: "Today", times: "Prayer times", qaza: "Qaza tracker", insights: "Insights" } as Record<DashboardTab, string>)[activeTab];
  const dateLabel = useMemo(() => day.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }), [day]);
  const isToday = dateKey(day) === dateKey(new Date());
  const isStartDay = !!startDate && dateKey(day) <= startDate;
  const prayerStreaks = useMemo(() => {
    if (typeof window === "undefined") return {};
    const today = dateKey(new Date());
    return calculatePrayerStreaks(today, dateKey(day), log, startDate, readSavedLogs());
  }, [log, day, startDate]);
  const trackerAnalysis = useMemo(() => {
    const today = dateKey(new Date());
    if (typeof window === "undefined" || !startDate) return calculateTrackerAnalysis({ startDate: startDate || today, logs: {}, qazaDone: [] }, today);
    const logs = readSavedLogs();
    logs[dateKey(day)] = log;
    const customNawafil = readAllCustomNawafil();
    customNawafil[dateKey(day)] = daily.customNawafil;
    return calculateTrackerAnalysis({ startDate, logs, marks: { [dateKey(day)]: marks }, customNawafil, qazaDone, qazaDoneOn }, today);
  }, [startDate, day, log, marks, daily.customNawafil, qazaDone, qazaDoneOn]);
  const displayedAnalysis = driveAnalysis || trackerAnalysis;
  const analysisSource = driveAnalysis
    ? `${driveEmail ? "Showing your Google Drive analysis" : "Showing your last saved Drive snapshot"} ? checked ${driveFetchedDay || "previously"}${drivePendingChanges > 0 ? " ? newer changes are waiting to sync" : ""}.`
    : "Showing a preview from this browser. Connect Google Drive to save it for future ranking views.";
  const openTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const saveProfile = (next: UserProfile) => {
    const name = next.name.trim().slice(0, 40);
    if (!name) return;
    const clean: UserProfile = { ...next, name, image: next.image, location: { city: location.city, country: location.country } };
    writeJson(localKeys.userProfile, clean);
    localStore.setItem(localKeys.userProfileCustom, "1");
    setProfile(clean);
    if (driveEmail && driveFileId) queueDriveChange();
    setShowProfileEditor(false);
  };
  const repairQaza = async () => {
    if (!driveToken || !driveFileId) { setToast("Connect Google Drive before repairing Qaza data."); return; }
    try {
      const port = createGoogleQazaDrive(driveToken, driveFileId); const worker = createQazaQueueWorker(port, qaza.repository, driveFileId);
      await repairQazaData(qaza.repository, worker); setSyncQueuePulse((value) => value + 1); setToast("Qaza statistics rebuilt from yearly records.");
    } catch { setToast("Repair could not finish. Your local Qaza records are still available."); }
  };
  const chooseQazaSetup = async (choice: QazaSetupChoice) => {
    const saved = await qaza.saveSetup(choice);
    if (saved.choice === "enter_existing_qaza") router.push("/dashboard/qaza/manual-backlog");
  };
  const savePrayerLocation = () => {
    const next = { city: cityDraft.trim(), country: countryDraft.trim(), method: methodDraft };
    if (!next.city || !next.country) { setTimingStatus("Enter both a city and country to load prayer times."); return; }
    writeJson(localKeys.prayerLocation, next);
    setLocation(next);
    const linkedProfile = { ...profile, location: { city: next.city, country: next.country } };
    setProfile(linkedProfile);
    if (linkedProfile.name.trim()) writeJson(localKeys.userProfile, linkedProfile);
    if (driveEmail && driveFileId && linkedProfile.name.trim()) queueDriveChange();
  };
  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };
  const handlePrayerToggle = (id: string) => {
    if (!isToday) return;
    if (marks[id]?.changedAt && marks[id].changedAt === syncedMarks[id]) {
      showToast("This prayer was synced and is locked for today. You can change it tomorrow.");
      return;
    }
    if (!log[id] && fard.some((prayer) => prayer.id === id)) {
      setAffirmationPrayer(id);
      return;
    }
    togglePrayer(id, "none", queueDriveChange, showToast);
  };
  const confirmPrayerMark = (affirmation: "oath" | "none") => {
    if (!affirmationPrayer || !isToday) return;
    togglePrayer(affirmationPrayer, affirmation, queueDriveChange, showToast);
    setAffirmationPrayer(null);
  };
  const changeDay = (offset: number) => setDay((prev) => { const next = addDays(prev, offset); if (startDate && dateKey(next) < startDate) return new Date(`${startDate}T12:00:00`); if (dateKey(next) > dateKey(new Date())) return new Date(); return next; });
  if (!ready) return <main className="loading-shell"><span className="brand-mark"><Moon size={20} fill="currentColor" /></span><span>Preparing your prayer journal…</span></main>;
  if (!driveAuthChecked || !driveToken) return <main className="loading-shell"><span className="brand-mark"><Moon size={20} fill="currentColor" /></span><span>Checking your Google Drive sign-in…</span></main>;
  if (!profile.name.trim()) return <main className="profile-required-shell"><ProfileEditor profile={profile} prayerLocation={location} driveConnected={!!driveEmail && !!driveToken} required onSave={saveProfile} onClose={() => undefined} onConnectGoogle={connectGoogleDrive} /></main>;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/"><span className="brand-mark"><Moon size={20} fill="currentColor" /></span><span>Salah<span className="brand-dot">.</span></span></a>
        <div className="nav-label">MENU</div>
        <nav><a className="nav-item" href="/"><House size={18} />Home</a><button className={`nav-item ${activeTab === "today" ? "active" : ""}`} onClick={() => openTab("today")}><LayoutDashboard size={18} />Dashboard</button><button className={`nav-item ${activeTab === "times" ? "active" : ""}`} onClick={() => openTab("times")}><CalendarDays size={18} />Prayer times</button><button className={`nav-item ${activeTab === "qaza" ? "active" : ""}`} onClick={() => openTab("qaza")}><Clock3 size={18} />Qaza tracker</button><button className={`nav-item ${activeTab === "insights" ? "active" : ""}`} onClick={() => openTab("insights")}><Heart size={18} />Insights</button><Link className="nav-item" href="/community"><BookOpen size={18} />Community</Link></nav>
        <div className="sidebar-bottom"><div className="quote-card"><span className="quote-spark">?</span><p>“Indeed, prayer has been decreed upon the believers a decree of specified times.”</p><span className="quote-ref">QURAN 4:103</span></div><button className="profile profile-button" onClick={() => setShowProfileEditor(true)} aria-label="Edit profile"><div className="avatar">{profile.image ? <img src={profile.image} alt="" /> : profile.name.trim().slice(0, 1).toUpperCase() || "U"}</div><div><b>{profile.name}</b><span>{driveEmail || "Your personal space"}</span></div><ChevronDown size={16} className="profile-chevron" /></button></div>
      </aside>

      <section className="main-area" id="today">
        <header className="topbar"><div className="breadcrumb">My space <span>/</span> <b>{activeTabLabel}</b></div><div className="top-actions"><span className="date-pill"><span className="live-dot" />{isToday ? "Today" : "Viewing past day"}</span><button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button><button className="profile-trigger" onClick={() => setShowProfileEditor(true)} aria-label="Edit your profile"><span className="profile-trigger-avatar">{profile.image ? <img src={profile.image} alt="" /> : profile.name.trim().slice(0, 1).toUpperCase() || "U"}</span><span className="profile-trigger-name">{profile.name}</span></button></div></header>
        <div className="content">
          {activeTab === "today" && <>
          <div className="welcome-row"><div><div className="eyebrow">YOUR DAILY PRACTICE <span>?</span></div><h1>A little consistency,<br /><em>a lot of barakah.</em></h1><p className="welcome-copy">Keep your prayers close, one moment at a time.</p></div><div className="moon-art" aria-hidden="true"><div className="moon-glow" /><div className="moon-shape" /><span className="star star-one">?</span><span className="star star-two">?</span><span className="star star-three">·</span></div></div>
          </>}
          <div className="date-nav"><button className="date-arrow" onClick={() => changeDay(-1)} aria-label="Previous day" disabled={isStartDay}><ChevronLeft size={18} /></button><div className="date-current"><CalendarDays size={16} /><span>{dateLabel}</span><span className="hijri">{isToday ? "A day to reconnect" : "Your prayer journal"}</span></div><button className="date-arrow" onClick={() => changeDay(1)} aria-label="Next day" disabled={dateKey(day) >= dateKey(new Date())}><ChevronRight size={18} /></button><button className="today-button" onClick={() => setDay(new Date())}>Today</button></div>
          {!driveEmail && <div className="drive-warning" role="note"><CircleHelp size={16} /><p><b>Google Drive isn’t connected.</b> Your prayer record is stored only in this Chrome browser, isn’t included in community rankings, and may be erased if browser data is cleared or Chrome is reset. Connect Drive to back it up.</p></div>}
          <SignIn profile={profile} accountEmail={driveEmail} connected={!!driveEmail && !!driveToken} status={driveStatus} onSignIn={() => connectGoogleDrive()} onEnableDailySync={() => { window.location.assign("/api/auth/google/start"); }}>
            <div className="drive-actions"><button className="drive-button secondary" onClick={refreshDriveData} disabled={driveRefreshUsedToday}><RefreshCw size={14} />{driveRefreshUsedToday ? "Refreshed today" : "Refresh from Drive"}</button><a className="drive-button secondary" href={`https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/view`} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open summary</a>{driveDayFileIds[dateKey(day)] && <a className="drive-button secondary" href={`https://drive.google.com/file/d/${encodeURIComponent(driveDayFileIds[dateKey(day)])}/view`} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open this day</a>}</div>
          </SignIn>
          <DashboardTabs active={activeTab} onChange={openTab} qazaPendingCount={qaza.pendingConfirmations.length} />
          {activeTab === "today" && <>
            <DailyOverview doneFard={doneFard} progress={progress} />
            <PrayerListSection fard={fard} relatedByFard={sunnahMuakkadahByFard} otherNawafil={otherNawafil} customNawafil={customNawafil} log={log} marks={marks} syncedMarks={syncedMarks} isToday={isToday} driveEmail={driveEmail} syncNow={syncNow} onToggle={handlePrayerToggle} onSync={(prayer) => requestPrayerSync(prayer.id, prayer.name)} onAddCustom={(name, rakaat) => { addCustomNafl(name, rakaat); queueDriveChange(); }} />
          </>}
          {activeTab === "times" && <PrayerTimesTab timingStatus={timingStatus} todayTimings={todayTimings} monthTimings={monthTimings} cityDraft={cityDraft} countryDraft={countryDraft} methodDraft={methodDraft} onCityChange={setCityDraft} onCountryChange={setCountryDraft} onMethodChange={setMethodDraft} onSaveLocation={savePrayerLocation} formatTime={formatPrayerTime} />}
          {activeTab === "qaza" && <><ReviewQueue records={qaza.pendingConfirmations} onAnswer={qaza.answerReview} /><QazaTracker repository={qaza.repository} refreshKey={qaza.refreshKey + syncQueuePulse} onComplete={qaza.complete} onLoadYear={loadQazaYear} /></>}
          {activeTab === "insights" && <InsightsTab analysis={displayedAnalysis} analysisSource={analysisSource} fard={fard} nawafil={nawafil} streaks={prayerStreaks} />}
          <FeatureRequestForm />
          <footer>Made with intention <span>&bull;</span> Your progress stays on this device.</footer>
        </div>
      </section>
      {showProfileEditor && <ProfileEditor profile={profile} prayerLocation={location} driveConnected={!!driveEmail && !!driveToken} onSave={saveProfile} onClose={() => setShowProfileEditor(false)} onRepair={() => void repairQaza()} />}
      {affirmationPrayer && <AffirmationDialog onChoose={confirmPrayerMark} onClose={() => setAffirmationPrayer(null)} />}
      {qaza.setupLoaded && !qaza.setup && <SetupWizard onChoose={chooseQazaSetup} />}
      {toast && <div className="toast"><span><Check size={14} /></span>{toast}</div>}
    </main>
  );
}







