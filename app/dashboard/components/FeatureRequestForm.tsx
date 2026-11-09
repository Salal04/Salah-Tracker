"use client";

import { useCallback, useEffect, useState } from "react";
import { Lightbulb, Send } from "lucide-react";

type UserRequest = { id: string; subject: string; details: string; status: string; adminReply: string | null; repliedBy: string | null; repliedAt: string | null; createdAt: string };

export function FeatureRequestForm() {
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const loadRequests = useCallback(async () => {
    const response = await fetch("/api/feature-requests", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { requests?: UserRequest[] };
    setRequests(data.requests || []);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void loadRequests().catch(() => undefined); }, 0); return () => window.clearTimeout(timer); }, [loadRequests]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/feature-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, details }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not send your request.");
      setSubject(""); setDetails(""); setStatus("Your request has been sent to the admin team."); await loadRequests();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not send your request."); }
    finally { setBusy(false); }
  };
  return <section className="feature-request-card"><div className="admin-section-heading"><div><span className="card-kicker"><Lightbulb size={12} /> YOUR IDEAS</span><h2>Request a feature</h2></div></div><p>Share an idea or report an issue. The admin team can review it here; premium features are still being planned.</p><form onSubmit={(event) => void submit(event)}><label>Title<input required minLength={4} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What would help you?" /></label><label>Details<textarea required minLength={10} maxLength={3000} rows={3} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Describe the feature or issue…" /></label><button type="submit" disabled={busy}><Send size={14} />{busy ? "Sending…" : "Send request"}</button></form>{status && <span className="feature-request-status" role="status">{status}</span>}{requests.length > 0 && <div className="user-request-list"><h3>Your requests and replies</h3>{requests.map((request) => <article key={request.id}><div><b>{request.subject}</b><span>{request.status} · {new Date(request.createdAt).toLocaleDateString()}</span></div><p>{request.details}</p>{request.adminReply && <aside><b>Reply from {request.repliedBy || "Salah Tracker admin"}</b>{request.repliedAt && <time>{new Date(request.repliedAt).toLocaleString()}</time>}<p>{request.adminReply}</p></aside>}</article>)}</div>}</section>;
}
