import { NextRequest, NextResponse } from "next/server";
import { getGoogleSessionUserId } from "@/lib/auth/google-session";
import { decryptGoogleRefreshToken, encryptGoogleRefreshToken } from "@/lib/auth/google-token";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

type GoogleTokenResponse = { access_token?: string; refresh_token?: string; error?: string };
type DriveFileList = { files?: Array<{ id?: string; name?: string }> };

export async function GET(request: NextRequest) {
  const userId = getGoogleSessionUserId(request);
  if (!userId) return NextResponse.json({ error: "Google session expired. Sign in again." }, { status: 401 });

  try {
    const [user, credential] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, profilePictureUrl: true, suspendedAt: true } }),
      prisma.googleDriveCredential.findUnique({ where: { userId } }),
    ]);
    if (user?.suspendedAt) return NextResponse.json({ error: "This account is suspended. Contact an administrator for help." }, { status: 403 });
    if (!user || !credential) return NextResponse.json({ error: "Google Drive authorization is missing." }, { status: 401 });

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
      console.warn("[auth] Could not renew Google access for the saved session.");
      return NextResponse.json({ error: "Google authorization expired. Sign in again." }, { status: 401 });
    }
    const tokens = await tokenResponse.json() as GoogleTokenResponse;
    if (!tokens.access_token) return NextResponse.json({ error: "Google did not return an access token." }, { status: 401 });

    let summaryFileId = credential.summaryFileId;
    if (!summaryFileId) {
      const query = encodeURIComponent("name='Salah Tracker Summary.json' and trashed=false");
      const filesResponse = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=drive&q=${query}&fields=files(id,name)&pageSize=10`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        cache: "no-store",
      });
      if (filesResponse.ok) {
        const fileList = await filesResponse.json() as DriveFileList;
        summaryFileId = fileList.files?.find((file) => file.name === "Salah Tracker Summary.json")?.id || null;
        if (summaryFileId) await prisma.googleDriveCredential.update({ where: { userId }, data: { summaryFileId } });
      }
    }

    if (tokens.refresh_token) {
      await prisma.googleDriveCredential.update({ where: { userId }, data: { refreshTokenEncrypted: encryptGoogleRefreshToken(tokens.refresh_token) } });
    }

    return NextResponse.json({
      accessToken: tokens.access_token,
      account: user,
      summaryFileId,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[auth] Could not restore Google session; no credential values were logged.");
    return NextResponse.json({ error: "Could not restore Google Drive session." }, { status: 503 });
  }
}
