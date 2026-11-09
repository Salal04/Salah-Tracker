import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Moon } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | Salah",
  description: "How Salah handles Google account information, prayer records, and aggregate statistics.",
};

const sections = [
  { title: "Information we handle", body: "When you connect Google Drive, Salah receives your Google account name, email address, profile photo URL, and a Google account identifier to create and maintain your account. Salah reads and writes your daily prayer files and summary in Google Drive. The summary may contain aggregate Qaza totals; individual Qaza records remain in this browser’s private IndexedDB repository. The app also stores your prayer entries and preferences in this browser so the tracker can work between visits." },
  { title: "How we use information", body: "We use Google account information to sign you in and associate your data with your account. We use your Drive files to restore and back up your tracker. When you open the app, it can read the tracker summary and save a limited set of aggregate counts to Neon: total fard prayers, on-time fard prayers, days with fard prayers, complete fard days, and best streak. Qaza details and individual daily prayer records are not saved to Neon or used for rankings." },
  { title: "Where information is stored", body: "Daily prayer records are stored in your Google Drive Salah Tracker files and browser storage. Individual Qaza records are kept in the private IndexedDB repository in the browser and are not uploaded to Drive or Neon. The Drive summary contains aggregate Qaza totals only. Neon stores your Google account identifier, email, name, profile photo URL, the aggregate statistics listed above, a Google Drive summary file identifier, the last daily sync date, and an encrypted Google refresh token used to keep your session connected. An essential signed, HTTP-only cookie keeps your app session active for up to 180 days. Short-lived Google access tokens are used to make authorized requests and are not saved in browser storage or database records." },
  { title: "Google access and sharing", body: "Salah requests the Google Drive file scope (drive.file) so it can work with files created or used by Salah, along with basic Google sign-in information. Google processes sign-in and Drive requests under its own terms and privacy policy. We use service providers for application hosting and the Neon database. We do not sell Google user data or share it for advertising. We do not use Google data to develop, improve, or train generalized AI or machine-learning models." },
  { title: "Retention and your choices", body: "Your browser copy remains until you clear the app’s browser storage. Drive files remain in your Google Drive until you delete them. Account information, aggregate statistics, and the encrypted refresh token remain in the app database while your account is active. You can revoke Salah’s access from your Google Account security settings; this stops future authorized access but does not automatically delete files already in Drive, browser data, or database records. To request deletion of app database records, contact us using the privacy contact listed below." },
  { title: "Security", body: "The app uses HTTPS when deployed over a secure domain, an HTTP-only session cookie, and encryption for stored Google refresh tokens. No online service can guarantee absolute security, so keep your Google account and devices protected." },
  { title: "Changes and contact", body: "We may update this policy as the app changes. The current version and effective date will be shown here. For privacy questions or requests to delete app database information, contact the privacy email below." },
];

export default function PrivacyPage() {
  const privacyEmail = process.env.PRIVACY_CONTACT_EMAIL?.trim();
  return (
    <main className="policy-page">
      <header className="policy-header">
        <Link className="landing-brand" href="/"><span className="brand-mark"><Moon size={18} fill="currentColor" /></span><span>Salah<span className="brand-dot">.</span></span></Link>
        <Link className="landing-nav-cta" href="/"><ArrowLeft size={14} /> Home</Link>
      </header>
      <article className="policy-content">
        <span className="landing-eyebrow">YOUR DATA, EXPLAINED</span>
        <h1>Privacy Policy</h1>
        <p className="policy-updated">Effective date: November 9, 2026</p>
        <p>This policy explains how Salah, a personal prayer tracking app, accesses, uses, and stores information when you use the service.</p>
        {sections.map(({ title, body }) => <section key={title}><h2>{title}</h2><p>{body}</p>{title === "Changes and contact" && <p>{privacyEmail ? <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a> : "Privacy contact email is not configured. Add PRIVACY_CONTACT_EMAIL before publishing."}</p>}</section>)}
        <nav className="policy-links" aria-label="Legal pages"><Link href="/terms">Terms of Service</Link><Link href="/">Salah home</Link></nav>
      </article>
    </main>
  );
}
