"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { UserProfile } from "@/lib/types";

type SignInProps = {
  profile: UserProfile;
  accountEmail: string;
  connected: boolean;
  status: string;
  onSignIn: () => void;
  onEnableDailySync: () => void;
  children?: ReactNode;
};

export function SignIn({ profile, accountEmail, connected, status, onSignIn, onEnableDailySync, children }: SignInProps) {
  const [dailySyncEnabled, setDailySyncEnabled] = useState(false);
  const initial = profile.name.trim().slice(0, 1).toUpperCase() || "G";

  useEffect(() => {
    void fetch("/api/auth/google/status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ enabled?: boolean }> : null)
      .then((result) => setDailySyncEnabled(result?.enabled === true))
      .catch(() => setDailySyncEnabled(false));
  }, []);

  return (
    <section className="drive-card" aria-label="Sign-In">
      <div className="drive-mark" aria-hidden="true">
        {connected && profile.image
          ? <img src={profile.image} alt="" style={{ width: "100%", height: "100%", borderRadius: "9px", objectFit: "cover" }} />
          : initial}
      </div>
      <div className="drive-copy">
        <b>{connected ? `Signed in as ${profile.name}` : "Sign-In with Google Drive"}</b>
        <span>{accountEmail || status || "Sign in to connect your Google Drive and back up your tracker."}</span>
      </div>
      {connected && children
        ? children
        : <button className="drive-button" onClick={onSignIn}>{accountEmail ? "Reconnect Google Drive" : "Sign In with Google"}</button>}
      {!dailySyncEnabled && <div className="drive-consent-note" role="note">
        <b>One-time setup for automatic stats</b>
        <p>Allow Google Drive access once so Salah can check your tracker summary when you open the app. Only your aggregate stats are saved to Neon; your prayer history and Qaza stay in Drive.</p>
        <button type="button" className="drive-consent-button" onClick={onEnableDailySync}>Allow once and keep me signed in</button>
      </div>}
    </section>
  );
}
