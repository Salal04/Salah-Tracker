import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const GOOGLE_SESSION_COOKIE = "salah_google_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 180;

function sign(value: string) {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET must be set to a random value of at least 32 characters.");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createGoogleSession(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function getGoogleSessionUserId(request: NextRequest) {
  const session = request.cookies.get(GOOGLE_SESSION_COOKIE)?.value;
  if (!session) return null;
  const [payload, signature] = session.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: unknown; expiresAt?: unknown };
    return typeof parsed.userId === "string" && typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now() / 1000
      ? parsed.userId
      : null;
  } catch {
    return null;
  }
}
