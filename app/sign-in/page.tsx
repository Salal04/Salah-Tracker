import Link from "next/link";
import { ArrowLeft, ArrowRight, Moon, ShieldCheck } from "lucide-react";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const { error } = await searchParams;
  return (
    <main className="landing-page sign-in-page">
      <header className="landing-header">
        <Link className="landing-brand" href="/"><span className="brand-mark"><Moon size={19} fill="currentColor" /></span><span>Salah<span className="brand-dot">.</span></span></Link>
        <Link className="landing-nav-cta" href="/"><ArrowLeft size={15} /> Back home</Link>
      </header>
      <section className="sign-in-content">
        <span className="landing-eyebrow"><ShieldCheck size={14} /> PRIVATE, PERSONAL TRACKING</span>
        <h1>Sign in to continue.</h1>
        <p>Google Drive sign-in is required to use your dashboard. Your prayer record stays backed up in Drive. Neon stores account details, an encrypted Drive credential, and aggregate stats—not daily prayer entries or Qaza. Approve access once, and your session will be restored when you return.</p>
        {error === "not-configured" && <p className="sign-in-error" role="alert">Google sign-in needs setup. Check the server OAuth credentials and try again.</p>}
        <Link className="landing-primary" href="/api/auth/google/start">Continue with Google Drive <ArrowRight size={16} /></Link>
        <nav className="sign-in-legal" aria-label="Legal"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></nav>
      </section>
    </main>
  );
}
