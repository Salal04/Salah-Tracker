"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, ExternalLink, Link2, Megaphone, Moon, Quote, Sparkles } from "lucide-react";

type CommunityData = {
  quote: { id: string; text: string; attribution: string | null } | null;
  quoteMode: "fixed" | "rotating";
  quoteDate: string;
  resources: { id: string; title: string; description: string | null; url: string; createdAt: string }[];
  announcements: { id: string; title: string; body: string; updatedAt: string }[];
};

export default function CommunityPage() {
  const [data, setData] = useState<CommunityData | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/community", { cache: "no-store" }).then(async (response) => {
      const result = await response.json() as CommunityData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Community content is not available right now.");
      if (active) setData(result);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load community content."); });
    return () => { active = false; };
  }, []);

  const copyQuote = async () => {
    if (!data?.quote) return;
    try { await navigator.clipboard.writeText(`“${data.quote.text}”${data.quote.attribution ? ` — ${data.quote.attribution}` : ""}`); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };

  if (!data && !error) return <main className="community-loading"><span className="brand-mark"><Moon size={20} fill="currentColor" /></span><span>Gathering a little inspiration…</span></main>;
  return <main className="community-page"><header className="community-header"><Link className="landing-brand" href="/"><span className="brand-mark"><Moon size={19} fill="currentColor" /></span><span>Salah<span className="brand-dot">.</span></span></Link><div><Link href="/dashboard" className="community-back"><ArrowLeft size={14} /> My tracker</Link></div></header>
    <div className="community-wrap"><section className="community-welcome"><span className="landing-eyebrow"><Sparkles size={13} /> A SHARED SPACE</span><h1>Pause. Reflect.<br /><em>Keep growing.</em></h1><p>A small collection of reminders, resources, and notes for our Salah Tracker community.</p><div className="community-orbit community-orbit-one"/><div className="community-orbit community-orbit-two"/><span className="community-star community-star-one">✦</span><span className="community-star community-star-two">✧</span></section>
      {error ? <div className="community-empty" role="alert">{error}</div> : data && <>
        <section className="community-daily-quote"><div className="community-quote-mark"><Quote size={19} /></div><div className="community-quote-meta"><span>DAILY REFLECTION</span><span><CalendarDays size={12} /> {new Date(`${data.quoteDate}T12:00:00Z`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</span></div>{data.quote ? <><blockquote>{data.quote.text}</blockquote><div className="community-quote-foot"><cite>{data.quote.attribution || "A moment to reflect"}</cite><button type="button" onClick={() => void copyQuote()}>{copied ? "Copied" : "Copy quote"}</button></div></> : <p className="community-empty-inline">A daily reflection will appear here soon.</p>}</section>

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
