import { NextRequest, NextResponse } from "next/server";
import { getGoogleSessionUserId } from "@/lib/auth/google-session";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  const userId = getGoogleSessionUserId(request);
  if (!userId) return NextResponse.json({ enabled: false });
  const credential = await prisma.googleDriveCredential.findUnique({ where: { userId }, select: { userId: true } });
  return NextResponse.json({ enabled: !!credential });
}
