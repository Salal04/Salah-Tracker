import { NextRequest, NextResponse } from "next/server";
import { createGoogleSession, GOOGLE_SESSION_COOKIE } from "@/lib/auth/google-session";
import { encryptGoogleRefreshToken } from "@/lib/auth/google-token";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
const STATE_COOKIE = "salah_google_oauth_state";

type GoogleTokenResponse = { access_token?: string; refresh_token?: string; error?: string };
type GoogleAccount = { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };

function failed(request: NextRequest, reason: string) {
  console.warn(`[auth] Offline Google authorization failed: ${reason}.`);
  return NextResponse.redirect(new URL(`/dashboard?autoSync=error`, request.url));
}

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const savedState = request.cookies.get(STATE_COOKIE)?.value;
  if (!state || !savedState || state !== savedState) return failed(request, "state validation");
  if (request.nextUrl.searchParams.has("error") || !code) return failed(request, "consent was declined or no authorization code was returned");

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return failed(request, "OAuth web client credentials are missing");
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || new URL("/api/auth/google/callback", request.url).toString();

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) return failed(request, "Google token exchange");
    const tokens = await tokenResponse.json() as GoogleTokenResponse;
    if (!tokens.access_token) return failed(request, "Google did not issue an access token");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
    });
    if (!profileResponse.ok) return failed(request, "Google profile verification");
    const account = await profileResponse.json() as GoogleAccount;
    if (!account.sub || !account.email || account.email_verified !== true) return failed(request, "verified account details were missing");

    const profilePictureUrl = typeof account.picture === "string" && account.picture.startsWith("https://") ? account.picture : null;
    const user = await prisma.user.upsert({
      where: { googleSubject: account.sub },
      create: {
        googleSubject: account.sub,
        email: account.email.toLowerCase(),
        name: (account.name || account.email.split("@")[0]).slice(0, 100),
        profilePictureUrl,
      },
      update: {
        email: account.email.toLowerCase(),
        name: (account.name || account.email.split("@")[0]).slice(0, 100),
        profilePictureUrl,
      },
      select: { id: true, suspendedAt: true },
    });
    if (user.suspendedAt) return failed(request, "this Salah Tracker account is suspended; contact an administrator");

    const prior = await prisma.googleDriveCredential.findUnique({ where: { userId: user.id }, select: { refreshTokenEncrypted: true } });
    const refreshTokenEncrypted = tokens.refresh_token
      ? encryptGoogleRefreshToken(tokens.refresh_token)
      : prior?.refreshTokenEncrypted;
    if (!refreshTokenEncrypted) return failed(request, "Google did not return a refresh token; reauthorize with consent");

    await prisma.googleDriveCredential.upsert({
      where: { userId: user.id },
      create: { userId: user.id, refreshTokenEncrypted },
      update: { refreshTokenEncrypted },
    });

    const response = NextResponse.redirect(new URL("/dashboard?autoSync=enabled", request.url));
    response.cookies.set(GOOGLE_SESSION_COOKIE, createGoogleSession(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
    response.cookies.set(STATE_COOKIE, "", { path: "/api/auth/google/callback", maxAge: 0 });
    console.info("[auth] Offline Drive authorization enabled; refresh token stored encrypted.");
    return response;
  } catch {
    console.error("[auth] Offline Drive authorization failed while saving credentials; no token values were logged.");
    return failed(request, "credential persistence");
  }
}
