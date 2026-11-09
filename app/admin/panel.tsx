"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Moon, ShieldCheck } from "lucide-react";

type UserRow = { id: string; email: string; name: string; createdAt: string; subscriptionExpiresAt: string | null; subscriptionState: "free" | "active" | "expired" };
type RequestRow = { id: string; email: string; subject: string; details: string; status: string; adminReply: string | null; repliedBy: string | null; repliedAt: string | null; createdAt: string };
type Snapshot = { account: { email: string }; users: UserRow[]; requests: RequestRow[]; admins: { email: string; createdAt: string }[] };

export default function AdminPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [subscriptionEmail, setSubscriptionEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notice, setNotice] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      const data = await response.json() as Snapshot & { error?: string };
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in with the admin Google account to continue." : data.error || "Admin access is required.");
      setSnapshot(data); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load the admin panel."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

  const mutate = async (payload: Record<string, string>) => {
    setNotice("");
    const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setNotice(data.error || "Could not save."); return; }
    setNotice("Saved."); await refresh();
  };

  const updateRequest = async (requestId: string, update: { status?: string; reply?: string }) => {
    const response = await fetch("/api/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, ...update }) });
    if (!response.ok) { const result = await response.json() as { error?: string }; setNotice(result.error || "Could not update the request."); return; }
    if (update.reply) setReplyDrafts((current) => ({ ...current, [requestId]: "" }));
    await refresh();
  };

  const deleteAccount = async (user: UserRow) => {
    const confirmed = window.confirm(`Delete ${user.name} (${user.email}) from Salah Tracker? Their account, subscription, Drive credential, stats, and feature requests stored here will be deleted. Existing files in their Google Drive will remain.`);
    if (!confirmed) return;
    const response = await fetch("/api/admin", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setNotice(result.error || "Could not delete this account."); return; }
    setNotice(`Deleted ${user.email}'s Salah Tracker account.`);
    await refresh();
  };

  if (loading && !snapshot && !error) return <main className="loading-shell"><span className="brand-mark"><Moon size={20} fill="currentColor" /></span><span>Loading admin panel…</span></main>;
  if (error) return <main className="drive-required-shell"><section className="drive-required-card"><span className="brand-mark"><Moon size={20} fill="currentColor" /></span><span className="landing-eyebrow"><ShieldCheck size={14} /> ADMIN PANEL</span><h1>Admin sign in required</h1><p>{error}</p><Link className="landing-primary" href="/api/auth/google/start">Continue with Google</Link><Link href="/">Back to Salah Tracker</Link></section></main>;
  if (!snapshot) return null;

  const statusFor = (user: UserRow) => user.subscriptionState === "active" ? "Active subscription" : user.subscriptionState === "expired" ? "Expired" : "Free";
  return <main className="admin-page"><header className="admin-header"><Link className="landing-brand" href="/"><span className="brand-mark"><Moon size={19} fill="currentColor" /></span><span>Salah<span className="brand-dot">.</span></span></Link><span className="admin-header-account"><ShieldCheck size={15} />{snapshot.account.email}</span><Link href="/" className="admin-back"><ArrowLeft size={15} /> Tracker</Link></header>
    <div className="admin-content"><span className="landing-eyebrow"><ShieldCheck size={14} /> ADMINISTRATION</span><h1>Admin panel</h1><p className="admin-intro">Manage access, subscriptions, and feature requests. Subscription status is tracked here; premium features are not available yet.</p>
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      <section className="admin-card"><div className="admin-section-heading"><div><span className="card-kicker">ACCESS</span><h2>Administrators</h2></div></div><form className="admin-inline-form" onSubmit={(event) => { event.preventDefault(); void mutate({ action: "add-admin", email }); setEmail(""); }}><label>Email for new admin<input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" /></label><button type="submit">Add admin</button></form><p className="admin-help">Added emails receive admin access automatically after signing in with that Google account.</p><ul className="admin-email-list"><li>salalshabbir242@gmail.com <span>Default admin</span></li>{snapshot.admins.filter((item) => item.email !== "salalshabbir242@gmail.com").map((item) => <li key={item.email}>{item.email}<span>Admin</span></li>)}</ul></section>
      <section className="admin-card"><div className="admin-section-heading"><div><span className="card-kicker">SUBSCRIPTIONS</span><h2>Users <span className="admin-count">{snapshot.users.length}</span></h2></div></div><form className="admin-inline-form admin-subscription-form" onSubmit={(event) => { event.preventDefault(); void mutate({ action: "subscription", email: subscriptionEmail, expiresAt }); }}><label>User email<input type="email" required value={subscriptionEmail} onChange={(event) => setSubscriptionEmail(event.target.value)} placeholder="user@example.com" /></label><label>Paid through<input type="date" required value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label><button type="submit">Update subscription</button></form><div className="admin-users">{snapshot.users.map((user) => <article className="admin-user" key={user.id}><div><b>{user.name}</b><span>{user.email}</span></div><div className="admin-user-actions"><span className={`admin-plan ${user.subscriptionState}`}>{statusFor(user)}{user.subscriptionExpiresAt && ` · ${new Date(user.subscriptionExpiresAt).toLocaleDateString()}`}</span>{user.subscriptionExpiresAt && <button type="button" className="admin-cancel-subscription" onClick={() => void mutate({ action: "subscription-free", email: user.email })}>Set free</button>}<button type="button" className="admin-delete-account" onClick={() => void deleteAccount(user)}>Delete account</button></div></article>)}</div><p className="admin-help">Deleting a user removes their Salah Tracker account and stored records. It does not delete files from their Google Drive.</p></section>
      <section className="admin-card"><div className="admin-section-heading"><div><span className="card-kicker">INBOX</span><h2>Feature requests <span className="admin-count">{snapshot.requests.length}</span></h2></div></div>{snapshot.requests.length === 0 ? <p className="admin-empty">No requests yet.</p> : <div className="admin-requests">{snapshot.requests.map((item) => <article className="admin-request" key={item.id}><div className="admin-request-top"><div><b>{item.subject}</b><span>{item.email} · {new Date(item.createdAt).toLocaleString()}</span></div><select aria-label={`Status for ${item.subject}`} value={item.status} onChange={(event) => void updateRequest(item.id, { status: event.target.value })}><option value="open">Open</option><option value="reviewed">Reviewed</option><option value="planned">Planned</option><option value="closed">Closed</option></select></div><p>{item.details}</p>{item.adminReply && <div className="admin-existing-reply"><b>Previous reply · {item.repliedBy}</b><p>{item.adminReply}</p></div>}<form className="admin-reply-form" onSubmit={(event) => { event.preventDefault(); void updateRequest(item.id, { reply: replyDrafts[item.id] || "" }); }}><label htmlFor={`reply-${item.id}`}>{item.adminReply ? "Update reply" : "Reply to user"}</label><textarea id={`reply-${item.id}`} maxLength={3000} minLength={1} required value={replyDrafts[item.id] ?? item.adminReply ?? ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Write a response the user can see in their dashboard…" /><button type="submit">{item.adminReply ? "Update reply" : "Send reply"}</button></form></article>)}</div>}</section>
      <p className="admin-private-note">Account and request data is private to administrators.</p>
    </div>
  </main>;
}
