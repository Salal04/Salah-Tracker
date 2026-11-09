"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Link2, Megaphone, Moon, Quote, Send } from "lucide-react";

type QuoteItem = { id: string; text: string; attribution: string | null; active: boolean; createdAt: string };
type ResourceItem = { id: string; title: string; description: string | null; url: string; published: boolean; createdAt: string };
type AnnouncementItem = { id: string; title: string; body: string; published: boolean; createdAt: string; updatedAt: string };
type ContentData = { settings: { quoteMode: "fixed" | "rotating"; fixedQuoteId: string | null }; quotes: QuoteItem[]; resources: ResourceItem[]; announcements: AnnouncementItem[] };

export default function AdminContentStudio() {
  const [data, setData] = useState<ContentData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [quoteMode, setQuoteMode] = useState<"fixed" | "rotating">("rotating");
  const [fixedQuoteId, setFixedQuoteId] = useState("");
  const [quoteText, setQuoteText] = useState("");
  const [attribution, setAttribution] = useState("");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/content", { cache: "no-store" });
      const result = await response.json() as ContentData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Admin access required.");
      setData(result); setQuoteMode(result.settings.quoteMode); setFixedQuoteId(result.settings.fixedQuoteId || ""); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load the content studio."); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

  const post = async (payload: Record<string, string>) => {
    setNotice("");
    try {
      const response = await fetch("/api/admin/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setNotice(result.error || "Could not save."); return false; }
      await refresh(); setNotice("Published and saved."); return true;
    } catch { setNotice("Could not reach the server."); return false; }
  };

  const toggle = async (action: string, id: string, value: boolean) => {
    setNotice("");
    const response = await fetch("/api/admin/content", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id, ...(action === "quote-active" ? { active: value } : { published: value }) }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setNotice(result.error || "Could not update this item."); return; }
    await refresh(); setNotice("Content updated.");
  };

  if (error) return <main className="drive-required-shell"><section className="drive-required-card"><span className="brand-mark"><Moon size={20} fill="currentColor" /></span><h1>Admin access required</h1><p>{error}</p><Link className="landing-primary" href="/admin">Back to admin panel</Link></section></main>;
  if (!data) return <main className="loading-shell"><span className="brand-mark"><Moon size={20} fill="currentColor" /></span><span>Opening content studio…</span></main>;

  return <main className="content-studio-page"><header className="admin-header"><Link className="landing-brand" href="/"><span className="brand-mark"><Moon size={19} fill="currentColor" /></span><span>Salah<span className="brand-dot">.</span></span></Link><Link href="/admin" className="admin-back"><ArrowLeft size={15} /> Admin panel</Link><Link href="/community" className="admin-back">Preview community ↗</Link></header>
    <div className="studio-content"><span className="landing-eyebrow"><BookOpen size={14} /> COMMUNITY CONTENT</span><h1>Content studio</h1><p className="admin-intro">Curate the daily quote, helpful links, and announcements everyone can see on the Community page.</p>{notice && <p className="admin-notice" role="status">{notice}</p>}
      <section className="studio-card quote-studio-card"><div className="studio-title"><span className="studio-icon"><Quote size={18} /></span><div><span className="card-kicker">DAILY QUOTE</span><h2>Set the rhythm</h2></div></div><div className="quote-mode-options"><label><input type="radio" name="quote-mode" checked={quoteMode === "rotating"} onChange={() => setQuoteMode("rotating")} /> Rotate one active quote each day</label><label><input type="radio" name="quote-mode" checked={quoteMode === "fixed"} onChange={() => setQuoteMode("fixed")} /> Keep one quote fixed</label></div>{quoteMode === "fixed" && <label className="studio-field">Fixed quote<select value={fixedQuoteId} onChange={(event) => setFixedQuoteId(event.target.value)}><option value="">Choose a quote</option>{data.quotes.filter((quote) => quote.active).map((quote) => <option key={quote.id} value={quote.id}>{quote.text.slice(0, 85)}</option>)}</select></label>}<button className="studio-primary" type="button" disabled={quoteMode === "fixed" && !fixedQuoteId} onClick={() => void post({ action: "quote-settings", mode: quoteMode, quoteId: fixedQuoteId })}>Save quote schedule</button>
        <form className="studio-form" onSubmit={async (event) => { event.preventDefault(); if (await post({ action: "add-quote", text: quoteText, attribution })) { setQuoteText(""); setAttribution(""); } }}><h3>Add a quote</h3><label className="studio-field">Quote<textarea required minLength={5} maxLength={600} rows={3} value={quoteText} onChange={(event) => setQuoteText(event.target.value)} placeholder="A thoughtful line for the community…" /></label><label className="studio-field">Attribution (optional)<input maxLength={160} value={attribution} onChange={(event) => setAttribution(event.target.value)} placeholder="Source or author" /></label><button className="studio-primary" type="submit"><Send size={13} />Publish quote</button></form>
        <div className="studio-item-list">{data.quotes.map((quote) => <article key={quote.id} className={!quote.active ? "is-unpublished" : ""}><div><p>“{quote.text}”</p><small>{quote.attribution || "No attribution"}{!quote.active && " · Archived"}</small></div><button type="button" onClick={() => void toggle("quote-active", quote.id, !quote.active)}>{quote.active ? "Archive" : "Restore"}</button></article>)}</div>
      </section>

      <section className="studio-card"><div className="studio-title"><span className="studio-icon"><Link2 size={18} /></span><div><span className="card-kicker">SHARED SOURCES</span><h2>Useful things to explore</h2></div></div><p className="studio-description">Add YouTube videos, Google Drive files, or any secure website link.</p><form className="studio-form" onSubmit={async (event) => { event.preventDefault(); if (await post({ action: "add-resource", title: resourceTitle, description: resourceDescription, url: resourceUrl })) { setResourceTitle(""); setResourceDescription(""); setResourceUrl(""); } }}><label className="studio-field">Title<input required minLength={2} maxLength={140} value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="e.g. A calming recitation" /></label><label className="studio-field">Link<input type="url" required value={resourceUrl} onChange={(event) => setResourceUrl(event.target.value)} placeholder="https://…" /></label><label className="studio-field">Short note (optional)<textarea rows={2} maxLength={600} value={resourceDescription} onChange={(event) => setResourceDescription(event.target.value)} placeholder="What will users find there?" /></label><button className="studio-primary" type="submit"><Send size={13} />Add source</button></form><div className="studio-item-list">{data.resources.map((item) => <article key={item.id} className={!item.published ? "is-unpublished" : ""}><div><b>{item.title}</b><small>{item.url}</small>{item.description && <p>{item.description}</p>}</div><button type="button" onClick={() => void toggle("resource-published", item.id, !item.published)}>{item.published ? "Unpublish" : "Publish"}</button></article>)}</div></section>

      <section className="studio-card"><div className="studio-title"><span className="studio-icon"><Megaphone size={18} /></span><div><span className="card-kicker">ANNOUNCEMENTS</span><h2>What’s new at Salah</h2></div></div><form className="studio-form" onSubmit={async (event) => { event.preventDefault(); if (await post({ action: "add-announcement", title: announcementTitle, bodyText: announcementBody })) { setAnnouncementTitle(""); setAnnouncementBody(""); } }}><label className="studio-field">Headline<input required minLength={3} maxLength={160} value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="A new feature is here" /></label><label className="studio-field">Announcement<textarea required minLength={5} maxLength={3000} rows={3} value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} placeholder="Share an update with everyone…" /></label><button className="studio-primary" type="submit"><Send size={13} />Publish announcement</button></form><div className="studio-item-list">{data.announcements.map((item) => <article key={item.id} className={!item.published ? "is-unpublished" : ""}><div><b>{item.title}</b><small>{new Date(item.updatedAt).toLocaleString()}</small><p>{item.body}</p></div><button type="button" onClick={() => void toggle("announcement-published", item.id, !item.published)}>{item.published ? "Unpublish" : "Publish"}</button></article>)}</div></section>
    </div>
  </main>;
}
