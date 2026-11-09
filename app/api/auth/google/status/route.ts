import { NextRequest, NextResponse } from "next/server";
import { getGoogleSessionUserId } from "@/lib/auth/google-session";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const userId = getGoogleSessionUserId(request);
  if (!userId) return NextResponse.json({ enabled: false });
  const [user, credential] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { suspendedAt: true } }),
    prisma.googleDriveCredential.findUnique({ where: { userId }, select: { userId: true } }),
  ]);
  if (user?.suspendedAt) return NextResponse.json({ enabled: false, suspended: true });
  return NextResponse.json({ enabled: !!credential });
}
