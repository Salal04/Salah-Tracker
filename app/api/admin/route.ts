import { NextRequest, NextResponse } from "next/server";
import { getAdminAccount } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminAccount(request);
    if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: request.cookies.has("salah_google_session") ? 403 : 401 });
    const [users, requests, admins] = await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, email: true, name: true, createdAt: true, subscriptionExpiresAt: true } }),
      prisma.featureRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, email: true, subject: true, details: true, status: true, createdAt: true } }),
      prisma.adminEmail.findMany({ orderBy: { createdAt: "desc" }, select: { email: true, createdAt: true } }),
    ]);
    const now = Date.now();
    return NextResponse.json({ account: admin, users: users.map((user) => ({ ...user, subscriptionState: !user.subscriptionExpiresAt ? "free" : user.subscriptionExpiresAt.getTime() > now ? "active" : "expired" })), requests, admins });
  } catch {
    return NextResponse.json({ error: "Admin data is unavailable. Apply database migrations and try again." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminAccount(request);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const data = body as { action?: unknown; email?: unknown; expiresAt?: unknown };
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

    if (data.action === "add-admin") {
      await prisma.adminEmail.upsert({ where: { email }, create: { email }, update: {} });
      return NextResponse.json({ saved: true });
    }
    if (data.action === "subscription") {
      if (typeof data.expiresAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.expiresAt)) return NextResponse.json({ error: "Choose a subscription end date." }, { status: 400 });
      const expiresAt = new Date(`${data.expiresAt}T23:59:59.999Z`);
      if (!Number.isFinite(expiresAt.getTime())) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) return NextResponse.json({ error: "This user must sign in once before a subscription can be assigned." }, { status: 404 });
      await prisma.user.update({ where: { id: user.id }, data: { subscriptionExpiresAt: expiresAt } });
      return NextResponse.json({ saved: true });
    }
    if (data.action === "subscription-free") {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
      await prisma.user.update({ where: { id: user.id }, data: { subscriptionExpiresAt: null } });
      return NextResponse.json({ saved: true });
    }
    return NextResponse.json({ error: "Unknown admin action." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Could not save this change." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminAccount(request);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const body = await request.json() as { requestId?: unknown; status?: unknown };
    if (typeof body.requestId !== "string" || !["open", "reviewed", "planned", "closed"].includes(String(body.status))) return NextResponse.json({ error: "Invalid request update." }, { status: 400 });
    await prisma.featureRequest.update({ where: { id: body.requestId }, data: { status: String(body.status) } });
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: "Could not update this request." }, { status: 503 });
  }
}
