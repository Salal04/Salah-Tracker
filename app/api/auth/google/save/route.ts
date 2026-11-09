import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

type GoogleAccount = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object") {
      console.warn("[auth] Google sign-in rejected: invalid request body.");
      return NextResponse.json({ error: "Invalid sign-in response." }, { status: 400 });
    }

    const { accessToken } = payload as { accessToken?: unknown };
    if (typeof accessToken !== "string" || accessToken.length < 20 || accessToken.length > 10_000) {
      console.warn("[auth] Google sign-in rejected: missing or invalid access token.");
      return NextResponse.json({ error: "Google sign-in did not return a valid access token." }, { status: 400 });
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!profileResponse.ok) {
      console.warn("[auth] Google sign-in rejected: Google profile verification failed.");
      return NextResponse.json({ error: "Google could not verify this sign-in. Please reconnect." }, { status: 401 });
    }

    const account = await profileResponse.json() as GoogleAccount;
    if (!account.sub || !account.email || account.email_verified !== true) {
      console.warn("[auth] Google sign-in rejected: verified account details were missing.");
      return NextResponse.json({ error: "A verified Google account is required." }, { status: 401 });
    }

    const profilePictureUrl = typeof account.picture === "string" && account.picture.startsWith("https://")
      ? account.picture
      : null;

    const existingUser = await prisma.user.findUnique({
      where: { googleSubject: account.sub },
      select: { id: true, suspendedAt: true },
    });
    if (existingUser?.suspendedAt) return NextResponse.json({ error: "This account is suspended. Contact an administrator for help." }, { status: 403 });
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
      select: { id: true, email: true, name: true, profilePictureUrl: true },
    });

    console.info(`[auth] Google sign-in succeeded; user record ${existingUser ? "updated" : "created"}.`);
    return NextResponse.json({ user });
  } catch {
    console.error("[auth] Google sign-in failed while saving the account; no credential values were logged.");
    return NextResponse.json({ error: "Could not save your Google account in the database." }, { status: 503 });
  }
}
