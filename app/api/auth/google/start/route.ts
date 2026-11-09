import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE = "salah_google_oauth_state";
const scopes = ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.file"];

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || !process.env.AUTH_SESSION_SECRET) {
    return NextResponse.redirect(new URL("/sign-in?error=not-configured", request.url));
  }

  const state = randomBytes(32).toString("base64url");
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || new URL("/api/auth/google/callback", request.url).toString();
  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  }).toString();

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google/callback",
    maxAge: 600,
  });
  return response;
}
