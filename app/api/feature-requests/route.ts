import { NextRequest, NextResponse } from "next/server";
import { getSessionAccount } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const account = await getSessionAccount(request);
  if (!account) return NextResponse.json({ error: "Sign in with Google to view your requests." }, { status: 401 });
  try {
    const requests = await prisma.featureRequest.findMany({
      where: { userId: account.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, subject: true, details: true, status: true, adminReply: true, repliedBy: true, repliedAt: true, createdAt: true },
    });
    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json({ error: "Could not load your requests." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const account = await getSessionAccount(request);
  if (!account) return NextResponse.json({ error: "Sign in with Google before sending a request." }, { status: 401 });
  try {
    const body = await request.json() as { subject?: unknown; details?: unknown };
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const details = typeof body.details === "string" ? body.details.trim() : "";
    if (subject.length < 4 || subject.length > 120 || details.length < 10 || details.length > 3000) {
      return NextResponse.json({ error: "Add a short title and at least 10 characters of detail." }, { status: 400 });
    }
    await prisma.featureRequest.create({ data: { userId: account.id, email: account.email, subject, details } });
    return NextResponse.json({ saved: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not send your request. Please try again." }, { status: 503 });
  }
}
