"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, ExternalLink, Link2, Megaphone, Moon, Quote, RefreshCw, Sparkles } from "lucide-react";

type CommunityData = {
  quote: { id: string; text: string; attribution: string | null } | null;
  quotes: { id: string; text: string; attribution: string | null }[];
  quoteMode: "fixed" | "rotating";
  quoteDate: string;
  resources: { id: string; title: string; description: string | null; url: string; createdAt: string }[];
  announcements: { id: string; title: string; body: string; updatedAt: string }[];
};
type RefreshState = { day: string; count: number; nextAt: number; quoteId: string | null };
const REFRESH_KEY = "salah-community-quote-refresh-v1";
const CONTENT_CACHE_KEY = "salah-community-content-v1";
type ContentCache = { day: string; fetchedAt: string; data: CommunityData };
const DAILY_REFRESH_LIMIT = 5;
const REFRESH_COOLDOWN_MS = 3 * 60 * 60 * 1000;

function localDay() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function CommunityPage() {
  const [data, setData] = useState<CommunityData | null>(null);
  const [currentQuoteId, setCurrentQuoteId] = useState("");
  const [refreshState, setRefreshState] = useState<RefreshState>({ day: "", count: 0, nextAt: 0, quoteId: null });
  const [clockNow, setClockNow] = useState(0);
  const [today, setToday] = useState("");
  const [error, setError] = useState("");
  const [refreshMessage, setRefreshMessage] = useState("");
  const [refreshingContent, setRefreshingContent] = useState(false);
  const [contentFetchedAt, setContentFetchedAt] = useState("");
  const [copied, setCopied] = useState(false);
  const hasDataRef = useRef(false);
  const applyContent = useCallback((result: CommunityData, day: string, fetchedAt: string) => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(REFRESH_KEY); } catch { /* Quotes remain usable if browser storage is disabled. */ }
    let parsed: RefreshState | null = null;
    try { parsed = saved ? JSON.parse(saved) as RefreshState : null; } catch { parsed = null; }
    const usage = parsed && parsed.day === day && Number.isInteger(parsed.count) && parsed.count >= 0 && parsed.count <= DAILY_REFRESH_LIMIT
      ? parsed
      : { day, count: 0, nextAt: 0, quoteId: result.quote?.id || null };
    hasDataRef.current = true;
    setData(result); setRefreshState(usage); setContentFetchedAt(fetchedAt); setError(""); setRefreshMessage("");
    const restored = result.quotes.find((quote) => quote.id === usage.quoteId);
    setCurrentQuoteId(restored?.id || result.quote?.id || "");
  }, []);

  const loadContent = useCallback(async (force = false) => {
    const day = localDay();
    if (!force) {
      try {
        const cached = localStorage.getItem(CONTENT_CACHE_KEY);
        const entry = cached ? JSON.parse(cached) as ContentCache : null;
        if (entry?.day === day && entry.data && Array.isArray(entry.data.quotes) && Array.isArray(entry.data.resources) && Array.isArray(entry.data.announcements)) {
          applyContent(entry.data, day, entry.fetchedAt);
          return;
        }
      } catch { /* Fetch fresh public content when local cache is missing or unreadable. */ }
    }
    if (force) { setRefreshingContent(true); setRefreshMessage(""); }
    try {
      const response = await fetch("/api/community", { cache: "no-store" });
      const result = await response.json() as CommunityData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Community content is not available right now.");
      const fetchedAt = new Date().toISOString();
      try { localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify({ day, fetchedAt, data: result } satisfies ContentCache)); } catch { /* Keep content in memory when browser storage is unavailable. */ }
      applyContent(result, day, fetchedAt);
      if (force) setRefreshMessage("Community content refreshed.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load community content.";
      if (hasDataRef.current) setRefreshMessage(`Could not refresh content: ${message}`);
      else setError(message);
    } finally { setRefreshingContent(false); }
  }, [applyContent]);

  useEffect(() => { const timer = window.setTimeout(() => void loadContent(), 0); return () => window.clearTimeout(timer); }, [loadContent]);

  useEffect(() => {
    const tick = () => { setClockNow(Date.now()); setToday(localDay()); };
    const timer = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 60_000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, []);

  const refreshQuote = () => {
    if (!data) return;
    const today = localDay();
    const current = refreshState.day === today ? refreshState : { day: today, count: 0, nextAt: 0, quoteId: data.quote?.id || null };
    const now = Date.now();
    if (current.count >= DAILY_REFRESH_LIMIT || now < current.nextAt || data.quotes.length < 2) return;
    const alternatives = data.quotes.filter((quote) => quote.id !== currentQuoteId);
    if (!alternatives.length) return;
    const next = alternatives[Math.floor(Math.random() * alternatives.length)];
    const updated = { day: today, count: current.count + 1, nextAt: now + REFRESH_COOLDOWN_MS, quoteId: next.id };
    try { localStorage.setItem(REFRESH_KEY, JSON.stringify(updated)); } catch { /* Keep this page's refresh selection even without browser storage. */ }
    setRefreshState(updated); setCurrentQuoteId(next.id); setClockNow(now); setToday(today); setCopied(false);
  };

  const copyQuote = async () => {
    const quote = data?.quotes.find((item) => item.id === currentQuoteId) || data?.quote;
    if (!quote) return;
    try { await navigator.clipboard.writeText(`“${quote.text}”${quote.attribution ? ` — ${quote.attribution}` : ""}`); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };

  const displayedQuote = data?.quotes.find((quote) => quote.id === currentQuoteId) || data?.quote;
  const activeUsage = refreshState.day === today ? refreshState : { day: today, count: 0, nextAt: 0, quoteId: data?.quote?.id || null };
  const cooldownRemaining = Math.max(0, activeUsage.nextAt - clockNow);
  const cooldownLabel = cooldownRemaining ? `${Math.floor(cooldownRemaining / 3_600_000)}h ${String(Math.floor((cooldownRemaining % 3_600_000) / 60_000)).padStart(2, "0")}m` : "";
  const refreshDisabled = !data || data.quotes.length < 2 || activeUsage.count >= DAILY_REFRESH_LIMIT || (!!cooldownRemaining && clockNow > 0);
  const refreshLabel = data?.quotes.length === 1 ? "Add more quotes to refresh" : activeUsage.count >= DAILY_REFRESH_LIMIT ? "Daily refresh limit reached" : cooldownLabel ? `Available in ${cooldownLabel}` : "New reflection";

  if (!data && !error) return <main className="community-loading"><span className="brand-mark"><Moon size={20} fill="currentColor" /></span><span>Gathering a little inspiration…</span></main>;
  return <main className="community-page"><header className="community-header"><Link className="landing-brand" href="/"><span className="brand-mark"><Moon size={19} fill="currentColor" /></span><span>Salah<span className="brand-dot">.</span></span></Link><div><Link href="/dashboard" className="community-back"><ArrowLeft size={14} /> My tracker</Link></div></header>
    <div className="community-wrap"><div className="community-toolbar"><span>{contentFetchedAt ? `Saved on this device · checked ${new Date(contentFetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Community content"}</span><button type="button" disabled={refreshingContent} onClick={() => void loadContent(true)}><RefreshCw size={13} className={refreshingContent ? "community-spinning" : ""} />{refreshingContent ? "Refreshing…" : "Refresh content"}</button></div>{refreshMessage && <p className="community-refresh-message" role="status">{refreshMessage}</p>}<section className="community-welcome"><span className="landing-eyebrow"><Sparkles size={13} /> A SHARED SPACE</span><h1>Pause. Reflect.<br /><em>Keep growing.</em></h1><p>A small collection of reminders, resources, and notes for our Salah Tracker community.</p><div className="community-orbit community-orbit-one"/><div className="community-orbit community-orbit-two"/><span className="community-star community-star-one">✦</span><span className="community-star community-star-two">✧</span></section>
      {error ? <div className="community-empty" role="alert">{error}</div> : data && <>
        <section className="community-daily-quote"><div className="community-quote-mark"><Quote size={19} /></div><div className="community-quote-meta"><span>DAILY REFLECTION</span><span><CalendarDays size={12} /> {new Date(`${data.quoteDate}T12:00:00Z`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</span></div>{displayedQuote ? <><blockquote key={displayedQuote.id} className="community-quote-text">{displayedQuote.text}</blockquote><div className="community-quote-foot"><cite>{displayedQuote.attribution || "A moment to reflect"}</cite><div className="community-quote-actions"><button type="button" onClick={() => void copyQuote()}>{copied ? "Copied" : "Copy quote"}</button><button className="community-refresh-quote" type="button" disabled={refreshDisabled} onClick={refreshQuote} title="Up to five new quotes per day, at least three hours apart"><RefreshCw size={12} />{refreshLabel}</button></div></div><span className="community-refresh-count">{Math.max(0, DAILY_REFRESH_LIMIT - activeUsage.count)} refresh{DAILY_REFRESH_LIMIT - activeUsage.count === 1 ? "" : "es"} left today · one every 3 hours</span></> : <p className="community-empty-inline">A daily reflection will appear here soon.</p>}</section>

        <div className="community-section-heading"><div><span className="card-kicker"><Megaphone size={12} /> FROM THE TEAM</span><h2>Community notes</h2></div><span className="community-count">{data.announcements.length} updates</span></div>
        {data.announcements.length ? <section className="community-announcements">{data.announcements.map((item, index) => <article key={item.id} className={index === 0 ? "community-announcement featured" : "community-announcement"}><div className="community-announcement-icon"><Megaphone size={16} /></div><div><span className="community-date">{new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span><h3>{item.title}</h3><p>{item.body}</p></div></article>)}</section> : <div className="community-empty-card">No announcements yet. Check back for new notes from the team.</div>}

        <div className="community-section-heading resources-heading"><div><span className="card-kicker"><Link2 size={12} /> THE RESOURCE SHELF</span><h2>Good things to explore</h2></div><span className="community-count">{data.resources.length} links</span></div>
        {data.resources.length ? <section className="community-resource-grid">{data.resources.map((item, index) => { let host = "Shared resource"; try { host = new URL(item.url).hostname.replace(/^www\./, ""); } catch { /* Admin links are validated before publishing. */ } return <article className="community-resource" key={item.id}><span className={`resource-number resource-tone-${index % 4}`}>{String(index + 1).padStart(2, "0")}</span><span className="resource-host">{host}</span><h3>{item.title}</h3><p>{item.description || "A resource shared with the Salah Tracker community."}</p><a href={item.url} target="_blank" rel="noreferrer">Open resource <ArrowUpRight size={14} /></a></article>; })}</section> : <div className="community-empty-card">The resource shelf is being prepared. Helpful links will be added here.</div>}
      </>}
      <section className="community-bottom-note"><BookOpen size={17} /><p>Use this page as a personal companion for reflection and helpful links. It’s a community noticeboard, not a source of religious rulings.</p><Link href="/dashboard">Return to your tracker <ExternalLink size={12} /></Link></section>
      <footer className="community-footer">Salah Tracker <span>·</span> Made with intention</footer>
    </div>
  </main>;
}
