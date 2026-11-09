import { NextRequest, NextResponse } from "next/server";
import { decryptGoogleRefreshToken } from "@/lib/auth/google-token";
import { getGoogleSessionUserId } from "@/lib/auth/google-session";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

type DriveSummary = {
  analysis?: {
    totalFard?: unknown;
    onTimeFard?: unknown;
    daysWithFard?: unknown;
    completeFardDays?: unknown;
    bestStreakDays?: unknown;
  };
};
type GoogleTokenResponse = { access_token?: string; refresh_token?: string; error?: string };
type DriveFileList = { files?: Array<{ id?: string; name?: string }> };

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000;

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  const userId = getGoogleSessionUserId(request);
  if (!userId) return NextResponse.json({ error: "Daily Drive authorization is not enabled." }, { status: 401 });

  let localDay: unknown;
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object") localDay = (body as { localDay?: unknown }).localDay;
  } catch {
    return NextResponse.json({ error: "Invalid sync request." }, { status: 400 });
  }
  if (typeof localDay !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(localDay)) {
    return NextResponse.json({ error: "A valid local date is required." }, { status: 400 });
  }

  try {
    const credential = await prisma.googleDriveCredential.findUnique({ where: { userId } });
    if (!credential) return NextResponse.json({ error: "Daily Drive authorization is not enabled." }, { status: 401 });
    if (credential.lastDriveStatsSyncDay === localDay) return NextResponse.json({ synced: false, reason: "already-synced" });

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return NextResponse.json({ error: "Google OAuth server credentials are missing." }, { status: 503 });

    const refreshToken = decryptGoogleRefreshToken(credential.refreshTokenEncrypted);
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) {
      console.warn("[stats] Daily Drive sync could not refresh the Google authorization.");
      return NextResponse.json({ error: "Google authorization expired; reconnect Drive." }, { status: 401 });
    }
    const tokens = await tokenResponse.json() as GoogleTokenResponse;
    if (!tokens.access_token) return NextResponse.json({ error: "Google did not return an access token." }, { status: 401 });

    const headers = { Authorization: `Bearer ${tokens.access_token}` };
    let fileId = credential.summaryFileId;
    if (!fileId) {
      const query = encodeURIComponent("name='Salah Tracker Summary.json' and trashed=false");
      const listResponse = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=files(id,name)&pageSize=10`, {
        headers,
        cache: "no-store",
      });
      if (!listResponse.ok) throw new Error("Drive summary lookup failed.");
      const list = await listResponse.json() as DriveFileList;
      fileId = list.files?.find((file) => file.name === "Salah Tracker Summary.json")?.id || null;
    }
    if (!fileId) return NextResponse.json({ synced: false, reason: "summary-not-found" });

    const summaryResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers,
      cache: "no-store",
    });
    if (!summaryResponse.ok) throw new Error("Drive summary download failed.");
    const summary = await summaryResponse.json() as DriveSummary;
    const analysis = summary.analysis;
    if (!analysis || !isCount(analysis.totalFard) || !isCount(analysis.onTimeFard) || !isCount(analysis.daysWithFard) || !isCount(analysis.completeFardDays) || !isCount(analysis.bestStreakDays)) {
      return NextResponse.json({ error: "Drive summary does not contain supported aggregate stats." }, { status: 422 });
    }

    await prisma.userStats.upsert({
      where: { userId },
      create: {
        userId,
        totalFard: analysis.totalFard,
        onTimeFard: analysis.onTimeFard,
        daysWithFard: analysis.daysWithFard,
        completeFardDays: analysis.completeFardDays,
        bestStreakDays: analysis.bestStreakDays,
      },
      update: {
        totalFard: analysis.totalFard,
        onTimeFard: analysis.onTimeFard,
        daysWithFard: analysis.daysWithFard,
        completeFardDays: analysis.completeFardDays,
        bestStreakDays: analysis.bestStreakDays,
      },
    });
    await prisma.googleDriveCredential.update({
      where: { userId },
      data: { summaryFileId: fileId, lastDriveStatsSyncDay: localDay },
    });

    console.info("[stats] Daily Drive summary read; aggregate stats saved to Neon (Qaza and daily records excluded).");
    return NextResponse.json({ synced: true });
  } catch {
    console.error("[stats] Daily Drive sync failed; credential values were not logged.");
    return NextResponse.json({ error: "Could not sync Drive aggregate stats to Neon." }, { status: 503 });
  }
}
