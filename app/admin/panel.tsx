"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, Download, Moon, ShieldCheck } from "lucide-react";

type UserRow = { id: string; email: string; name: string; createdAt: string; subscriptionExpiresAt: string | null; suspendedAt: string | null; subscriptionState: "free" | "active" | "expired" };
type RequestRow = { id: string; email: string; subject: string; details: string; status: string; adminReply: string | null; repliedBy: string | null; repliedAt: string | null; createdAt: string };
type AuditRow = { id: string; adminEmail: string; action: string; targetEmail: string; details: string | null; createdAt: string };
type Snapshot = { account: { email: string }; users: UserRow[]; requests: RequestRow[]; admins: { email: string; createdAt: string }[]; auditLog: AuditRow[] };
const DEFAULT_ADMIN = "salalshabbir242@gmail.com";
const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

export default function AdminPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [subscriptionEmail, setSubscriptionEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notice, setNotice] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [requestSearch, setRequestSearch] = useState("");
  const [requestFilter, setRequestFilter] = useState("all");
  const [newRequestCount, setNewRequestCount] = useState(0);
  const seenRequestIds = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      const data = await response.json() as Snapshot & { error?: string };
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in with the admin Google account to continue." : data.error || "Admin access is required.");
      const ids = new Set(data.requests.map((item) => item.id));
      if (seenRequestIds.current) {
        const arrived = data.requests.filter((item) => !seenRequestIds.current?.has(item.id));
        if (arrived.length) {
          setNewRequestCount((count) => count + arrived.length);
          setNotice(`${arrived.length} new feature request${arrived.length === 1 ? "" : "s"} received.`);
        }
      }
      seenRequestIds.current = ids;
      setSnapshot(data); setError("");
    } catch (cause) {
      if (!seenRequestIds.current) setError(cause instanceof Error ? cause.message : "Could not load the admin panel.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => { const timer = window.setInterval(() => void refresh(), 30_000); return () => window.clearInterval(timer); }, [refresh]);

  const mutate = async (payload: Record<string, string>) => {
    setNotice("");
    const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setNotice(data.error || "Could not save."); return; }
    await refresh();
    setNotice("Saved.");
  };

  const updateRequest = async (requestId: string, update: { status?: string; reply?: string }) => {
    const response = await fetch("/api/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, ...update }) });
    if (!response.ok) { const result = await response.json() as { error?: string }; setNotice(result.error || "Could not update the request."); return; }
    if (update.reply) setReplyDrafts((current) => ({ ...current, [requestId]: "" }));
    await refresh();
  };

  const deleteAccount = async (user: UserRow) => {
    if (!window.confirm(`Delete ${user.name} (${user.email}) from Salah Tracker? App records and the stored Drive credential will be deleted. Files in their Google Drive will remain.`)) return;
    const response = await fetch("/api/admin", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setNotice(result.error || "Could not delete this account."); return; }
    await refresh(); setNotice(`Deleted ${user.email}'s Salah Tracker account.`);
  };

  const exportUsers = () => {
    if (!snapshot) return;
    const admins = new Set([DEFAULT_ADMIN, ...snapshot.admins.map((item) => item.email.toLowerCase())]);
    const rows = [["Name", "Email", "Subscription", "Paid through", "Admin", "Account status", "Created"], ...snapshot.users.map((user) => [
      user.name, user.email, user.subscriptionState, user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toISOString().slice(0, 10) : "", admins.has(user.email.toLowerCase()) ? "yes" : "no", user.suspendedAt ? "suspended" : "active", new Date(user.createdAt).toISOString(),
    ])];
    const blob = new Blob([rows.map((row) => row.map((value) => csvCell(String(value))).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `salah-tracker-users-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  if (loading && !snapshot && !error) return <main className="loading-shell"><span className="brand-mark"><Moon size={20} fill="currentColor" /></span><span>Loading admin panel…</span></main>;
  if (error) return <main className="drive-required-shell"><section className="drive-required-card"><span className="brand-mark"><Moon size={20} fill="currentColor" /></span><span className="landing-eyebrow"><ShieldCheck size={14} /> ADMIN PANEL</span><h1>Admin sign in required</h1><p>{error}</p><Link className="landing-primary" href="/api/auth/google/start">Continue with Google</Link><Link href="/">Back to Salah Tracker</Link></section></main>;
  if (!snapshot) return null;

  const adminEmails = new Set([DEFAULT_ADMIN, ...snapshot.admins.map((item) => item.email.toLowerCase())]);
  const statusFor = (user: UserRow) => user.subscriptionState === "active" ? "Active subscription" : user.subscriptionState === "expired" ? "Expired" : "Free";
  const filteredUsers = snapshot.users.filter((user) => {
    const admin = adminEmails.has(user.email.toLowerCase());
    const state = user.suspendedAt ? "suspended" : admin ? "admin" : user.subscriptionState;
    return (userFilter === "all" || state === userFilter) && `${user.name} ${user.email}`.toLowerCase().includes(userSearch.trim().toLowerCase());
  });
  const filteredRequests = snapshot.requests.filter((item) => (requestFilter === "all" || item.status === requestFilter) && `${item.subject} ${item.email} ${item.details}`.toLowerCase().includes(requestSearch.trim().toLowerCase()));
  const subscriptionHistory = snapshot.auditLog.filter((item) => item.action.startsWith("subscription-"));

  return <main className="admin-page"><header className="admin-header"><Link className="landing-brand" href="/"><span className="brand-mark"><Moon size={19} fill="currentColor" /></span><span>Salah<span className="brand-dot">.</span></span></Link><span className="admin-header-account"><ShieldCheck size={15} />{snapshot.account.email}</span><Link href="/admin/content" className="admin-back">Content studio</Link><Link href="/" className="admin-back"><ArrowLeft size={15} /> Tracker</Link></header>
    <div className="admin-content"><span className="landing-eyebrow"><ShieldCheck size={14} /> ADMINISTRATION</span><h1>Admin panel</h1><p className="admin-intro">Manage access, subscriptions, and feature requests. Subscription status is tracked here; premium features are not available yet.</p>
      {newRequestCount > 0 && <button className="admin-notification" type="button" onClick={() => { setNewRequestCount(0); document.getElementById("admin-inbox")?.scrollIntoView({ behavior: "smooth" }); }}><Bell size={15} />{newRequestCount} new request{newRequestCount === 1 ? "" : "s"} · View inbox</button>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      <section className="admin-card"><div className="admin-section-heading"><div><span className="card-kicker">ACCESS</span><h2>Administrators</h2></div></div><form className="admin-inline-form" onSubmit={(event) => { event.preventDefault(); void mutate({ action: "add-admin", email }); setEmail(""); }}><label>Email for new or returning admin<input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" /></label><button type="submit">Add / reinstate admin</button></form><p className="admin-help">Admin access takes effect when that person signs in with this Google account.</p><ul className="admin-email-list"><li>{DEFAULT_ADMIN} <span>Default admin · protected</span></li>{snapshot.admins.filter((item) => item.email.toLowerCase() !== DEFAULT_ADMIN).map((item) => <li key={item.email}>{item.email}<button type="button" className="admin-cancel-subscription" onClick={() => void mutate({ action: "remove-admin", email: item.email })}>Remove admin</button></li>)}</ul></section>

      <section className="admin-card"><div className="admin-section-heading"><div><span className="card-kicker">SUBSCRIPTIONS AND ACCOUNTS</span><h2>Users <span className="admin-count">{snapshot.users.length}</span></h2></div><button type="button" className="admin-export" onClick={exportUsers}><Download size={14} />Export CSV</button></div><form className="admin-inline-form admin-subscription-form" onSubmit={(event) => { event.preventDefault(); void mutate({ action: "subscription", email: subscriptionEmail, expiresAt }); }}><label>User email<input type="email" required value={subscriptionEmail} onChange={(event) => setSubscriptionEmail(event.target.value)} placeholder="user@example.com" /></label><label>Paid through<input type="date" required value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label><button type="submit">Update subscription</button></form><div className="admin-filters"><label>Search users<input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Name or email" /></label><label>Filter<select value={userFilter} onChange={(event) => setUserFilter(event.target.value)}><option value="all">All users</option><option value="free">Free</option><option value="active">Active subscription</option><option value="expired">Expired subscription</option><option value="suspended">Suspended</option><option value="admin">Admins</option></select></label></div><div className="admin-users">{filteredUsers.map((user) => { const isAdmin = adminEmails.has(user.email.toLowerCase()); return <article className="admin-user" key={user.id}><div><b>{user.name}{isAdmin && <span className="admin-role-pill">Admin</span>}</b><span>{user.email}</span></div><div className="admin-user-actions"><span className={`admin-plan ${user.suspendedAt ? "suspended" : user.subscriptionState}`}>{user.suspendedAt ? "Suspended" : statusFor(user)}{user.subscriptionExpiresAt && ` · ${new Date(user.subscriptionExpiresAt).toLocaleDateString()}`}</span>{!isAdmin && !user.suspendedAt && <button type="button" className="admin-cancel-subscription" onClick={() => void mutate({ action: "suspend-account", email: user.email })}>Suspend</button>}{!isAdmin && !!user.suspendedAt && <button type="button" className="admin-reinstate-account" onClick={() => void mutate({ action: "reinstate-account", email: user.email })}>Reinstate</button>}{user.subscriptionExpiresAt && <button type="button" className="admin-cancel-subscription" onClick={() => void mutate({ action: "subscription-free", email: user.email })}>Set free</button>}<button type="button" className="admin-delete-account" onClick={() => void deleteAccount(user)}>Delete account</button></div></article>; })}{filteredUsers.length === 0 && <p className="admin-empty">No users match this filter.</p>}</div><p className="admin-help">Suspension blocks future sign-ins and stops active app sessions within about 30 seconds. Deleting removes app records and Drive credentials; it does not delete Google Drive files.</p></section>

      <section className="admin-card" id="admin-inbox"><div className="admin-section-heading"><div><span className="card-kicker">INBOX</span><h2>Feature requests <span className="admin-count">{snapshot.requests.length}</span></h2></div></div><div className="admin-filters"><label>Search requests<input value={requestSearch} onChange={(event) => setRequestSearch(event.target.value)} placeholder="Title, email, or details" /></label><label>Filter<select value={requestFilter} onChange={(event) => setRequestFilter(event.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="reviewed">Reviewed</option><option value="planned">Planned</option><option value="closed">Closed</option></select></label></div>{filteredRequests.length === 0 ? <p className="admin-empty">No requests match this filter.</p> : <div className="admin-requests">{filteredRequests.map((item) => <article className="admin-request" key={item.id}><div className="admin-request-top"><div><b>{item.subject}</b><span>{item.email} · {new Date(item.createdAt).toLocaleString()}</span></div><select aria-label={`Status for ${item.subject}`} value={item.status} onChange={(event) => void updateRequest(item.id, { status: event.target.value })}><option value="open">Open</option><option value="reviewed">Reviewed</option><option value="planned">Planned</option><option value="closed">Closed</option></select></div><p>{item.details}</p>{item.adminReply && <div className="admin-existing-reply"><b>Previous reply · {item.repliedBy}</b><p>{item.adminReply}</p></div>}<form className="admin-reply-form" onSubmit={(event) => { event.preventDefault(); void updateRequest(item.id, { reply: replyDrafts[item.id] || "" }); }}><label htmlFor={`reply-${item.id}`}>{item.adminReply ? "Update reply" : "Reply to user"}</label><textarea id={`reply-${item.id}`} maxLength={3000} minLength={1} required value={replyDrafts[item.id] ?? item.adminReply ?? ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Write a response the user can see in their dashboard…" /><button type="submit">{item.adminReply ? "Update reply" : "Send reply"}</button></form></article>)}</div>}</section>

      <section className="admin-card"><div className="admin-section-heading"><div><span className="card-kicker">AUDIT</span><h2>Subscription history</h2></div></div>{subscriptionHistory.length ? <div className="admin-audit-list">{subscriptionHistory.map((item) => <article key={item.id}><span className="admin-audit-action">{item.action === "subscription-set" ? "Plan updated" : "Plan set to free"}</span><b>{item.targetEmail}</b><span>{item.details}</span><time>{new Date(item.createdAt).toLocaleString()} · {item.adminEmail}</time></article>)}</div> : <p className="admin-empty">No subscription changes have been recorded yet.</p>}</section>
      <p className="admin-private-note">Account and request data is private to administrators. Admin changes are recorded.</p>
    </div>
  </main>;
}
