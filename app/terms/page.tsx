import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Moon } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service | Salah",
  description: "Terms for using the Salah personal prayer tracking app.",
};

export default function TermsPage() {
  return (
    <main className="policy-page">
      <header className="policy-header">
        <Link className="landing-brand" href="/"><span className="brand-mark"><Moon size={18} fill="currentColor" /></span><span>Salah<span className="brand-dot">.</span></span></Link>
        <Link className="landing-nav-cta" href="/"><ArrowLeft size={14} /> Home</Link>
      </header>
      <article className="policy-content">
        <span className="landing-eyebrow">USING SALAH</span>
        <h1>Terms of Service</h1>
        <p className="policy-updated">Effective date: November 9, 2026</p>
        <p>By using Salah, you agree to these terms. If you do not agree, do not use the service.</p>
        <section><h2>What Salah provides</h2><p>Salah is a personal tool for recording prayer activity, maintaining a Qaza tracker, viewing prayer times, and reviewing personal statistics. It is not a source of religious rulings. You are responsible for how you interpret and use your records.</p></section>
        <section><h2>Your account and data</h2><p>A Google account and Google Drive authorization are required to use the dashboard. You are responsible for keeping your Google account secure and for maintaining any copies of your records that you want to keep. Google Drive files remain subject to Google’s terms. See our <Link href="/privacy">Privacy Policy</Link> for details on data handling and deletion requests.</p></section>
        <section><h2>Acceptable use</h2><p>Use Salah lawfully and do not attempt to disrupt the service, access another person’s account or records, or misuse the service or its underlying systems.</p></section>
        <section><h2>Availability and changes</h2><p>We work to keep Salah available and your records synchronized, but we cannot guarantee uninterrupted service or that every sync will succeed. Features may change or be discontinued. Keep your own copy of important information.</p></section>
        <section><h2>No warranty</h2><p>Salah is provided as available, without a guarantee that it will meet every need or be error-free. To the extent permitted by applicable law, we are not responsible for loss caused by unavailable service, failed synchronization, or data stored in your browser or Google Drive.</p></section>
        <section><h2>Changes and contact</h2><p>We may update these terms when the service changes. Continued use after an update means you accept the revised terms. For questions, use the privacy contact listed in our <Link href="/privacy">Privacy Policy</Link>.</p></section>
        <nav className="policy-links" aria-label="Legal pages"><Link href="/privacy">Privacy Policy</Link><Link href="/">Salah home</Link></nav>
      </article>
    </main>
  );
}
