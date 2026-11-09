import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowRight, CalendarDays, Check, Flame, Heart, Moon, ShieldCheck, Sparkles } from "lucide-react";

const features = [
  { icon: CalendarDays, title: "A clear daily view", text: "Mark each fard prayer as you go, with sunnah and nawafil close at hand." },
  { icon: Heart, title: "Gentle Qaza tracking", text: "Keep missed fard prayers in a simple list and work through them a few at a time." },
  { icon: Flame, title: "Your own prayer streaks", text: "See consecutive-day streaks for each prayer, with room to begin again." },
];

export default function HomePage() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="Salah home"><span className="brand-mark"><Moon size={19} fill="currentColor" /></span><span>Salah<span className="brand-dot">.</span></span></Link>
        <nav className="landing-nav" aria-label="Main navigation"><a href="#about">About</a><a href="#features">Features</a><Link className="landing-nav-cta" href="/dashboard">Go to your dashboard <ArrowRight size={15} /></Link></nav>
      </header>

      <section className="landing-hero" id="about">
        <div className="landing-hero-copy">
          <span className="landing-eyebrow"><Sparkles size={14} /> A QUIET SPACE FOR YOUR DAILY PRACTICE</span>
          <h1>Make room for<br /><em>what matters.</em></h1>
          <p className="landing-lede">Salah is a calm, personal prayer journal to help you keep track of fard salah, build steady habits, and gently work through Qaza.</p>
          <div className="landing-actions"><Link className="landing-primary" href="/dashboard">Go to your dashboard <ArrowRight size={17} /></Link><a className="landing-secondary" href="#features">Discover the features <ArrowDownRight size={16} /></a></div>
          <div className="landing-trust"><ShieldCheck size={15} /><span>Your prayer log stays yours. Save it on this device or back it up to your Google Drive.</span></div>
          <div className="landing-data-warning"><AlertTriangle size={17} /><p><b>Google Drive sign-in is required</b><br />Connect your Google account to use Salah and keep your prayer record backed up in Drive. Neon stores account details, an encrypted Drive credential, and aggregate stats; daily records and Qaza stay in Drive.</p></div>
        </div>
        <div className="landing-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-moon" /><span className="art-star star-a">✦</span><span className="art-star star-b">✧</span><span className="art-star star-c">·</span><div className="art-note"><span className="art-note-icon"><Check size={14} /></span><span><b>One prayer at a time</b><small>A little consistency, a lot of barakah.</small></span></div></div>
      </section>

      <section className="landing-features" id="features">
        <div className="landing-section-intro"><span className="landing-eyebrow">MADE FOR A STEADY ROUTINE</span><h2>Keep your practice<br /><em>simple and personal.</em></h2><p>Everything you need to reflect on your day, all in one quiet place.</p></div>
        <div className="landing-feature-grid">{features.map(({ icon: Icon, title, text }, index) => <article className="landing-feature" key={title}><span className={`landing-feature-icon feature-${index}`}><Icon size={19} /></span><h3>{title}</h3><p>{text}</p><span className="feature-index">0{index + 1}</span></article>)}</div>
      </section>

      <section className="landing-bottom"><div><span className="landing-eyebrow">YOUR NEXT MOMENT STARTS HERE</span><h2>Start where you are.</h2><p>Open your dashboard and take today one prayer at a time.</p></div><Link className="landing-primary" href="/dashboard">Go to your dashboard <ArrowRight size={17} /></Link></section>
      <footer className="landing-footer"><Link className="landing-brand footer-brand" href="/"><span className="brand-mark"><Moon size={16} fill="currentColor" /></span><span>Salah<span className="brand-dot">.</span></span></Link><nav className="landing-footer-links" aria-label="Legal"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></nav><span>Made with intention <Sparkles size={12} className="footer-spark" /></span><span>Prayer is a moment to return.</span></footer>
    </main>
  );
}
