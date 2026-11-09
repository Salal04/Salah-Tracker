import { NextRequest, NextResponse } from "next/server";
import { getAdminAccount, isDefaultAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminAccount(request);
    if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: request.cookies.has("salah_google_session") ? 403 : 401 });
    const [users, requests, admins, auditLog] = await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, email: true, name: true, createdAt: true, subscriptionExpiresAt: true, suspendedAt: true } }),
      prisma.featureRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, email: true, subject: true, details: true, status: true, adminReply: true, repliedBy: true, repliedAt: true, createdAt: true } }),
      prisma.adminEmail.findMany({ orderBy: { createdAt: "desc" }, select: { email: true, createdAt: true } }),
      prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { id: true, adminEmail: true, action: true, targetEmail: true, details: true, createdAt: true } }),
    ]);
    const now = Date.now();
    return NextResponse.json({ account: admin, users: users.map((user) => ({ ...user, subscriptionState: !user.subscriptionExpiresAt ? "free" : user.subscriptionExpiresAt.getTime() > now ? "active" : "expired" })), requests, admins, auditLog });
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
      await prisma.adminAuditLog.create({ data: { adminEmail: admin.email, action: "admin-add", targetEmail: email, details: "Admin access granted." } });
      return NextResponse.json({ saved: true });
    }
    if (data.action === "remove-admin") {
      if (isDefaultAdmin(email)) return NextResponse.json({ error: "The default admin cannot be removed." }, { status: 400 });
      if (email === admin.email.toLowerCase()) return NextResponse.json({ error: "You cannot remove your own admin access." }, { status: 400 });
      const removed = await prisma.adminEmail.deleteMany({ where: { email } });
      if (removed.count === 0) return NextResponse.json({ error: "Admin access was not found." }, { status: 404 });
      await prisma.adminAuditLog.create({ data: { adminEmail: admin.email, action: "admin-remove", targetEmail: email, details: "Admin access removed." } });
      return NextResponse.json({ saved: true });
    }
    if (data.action === "subscription") {
      if (typeof data.expiresAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.expiresAt)) return NextResponse.json({ error: "Choose a subscription end date." }, { status: 400 });
      const expiresAt = new Date(`${data.expiresAt}T23:59:59.999Z`);
      if (!Number.isFinite(expiresAt.getTime())) return NextResponse.json({ error: "Invalid date." }, { status: 400 });
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, subscriptionExpiresAt: true } });
      if (!user) return NextResponse.json({ error: "This user must sign in once before a subscription can be assigned." }, { status: 404 });
      await prisma.user.update({ where: { id: user.id }, data: { subscriptionExpiresAt: expiresAt } });
      await prisma.adminAuditLog.create({ data: { adminEmail: admin.email, action: "subscription-set", targetEmail: email, details: `${user.subscriptionExpiresAt?.toISOString() || "free"} → ${expiresAt.toISOString()}` } });
      return NextResponse.json({ saved: true });
    }
    if (data.action === "subscription-free") {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, subscriptionExpiresAt: true } });
      if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
      await prisma.user.update({ where: { id: user.id }, data: { subscriptionExpiresAt: null } });
      await prisma.adminAuditLog.create({ data: { adminEmail: admin.email, action: "subscription-free", targetEmail: email, details: `Previous end date: ${user.subscriptionExpiresAt?.toISOString() || "none"}` } });
      return NextResponse.json({ saved: true });
    }
    if (data.action === "suspend-account" || data.action === "reinstate-account") {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, suspendedAt: true } });
      if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
      if (isDefaultAdmin(email) || await prisma.adminEmail.findUnique({ where: { email }, select: { email: true } })) return NextResponse.json({ error: "Admin accounts cannot be suspended." }, { status: 400 });
      const suspended = data.action === "suspend-account";
      await prisma.user.update({ where: { id: user.id }, data: { suspendedAt: suspended ? new Date() : null } });
      await prisma.adminAuditLog.create({ data: { adminEmail: admin.email, action: suspended ? "account-suspend" : "account-reinstate", targetEmail: email, details: suspended ? "Account suspended." : `Account reinstated${user.suspendedAt ? ` after ${user.suspendedAt.toISOString()}` : ""}.` } });
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
    const body = await request.json() as { requestId?: unknown; status?: unknown; reply?: unknown };
    if (typeof body.requestId !== "string") return NextResponse.json({ error: "Invalid request update." }, { status: 400 });
    const data: { status?: string; adminReply?: string; repliedBy?: string; repliedAt?: Date } = {};
    if (body.status !== undefined) {
      if (!["open", "reviewed", "planned", "closed"].includes(String(body.status))) return NextResponse.json({ error: "Invalid request status." }, { status: 400 });
      data.status = String(body.status);
    }
    if (body.reply !== undefined) {
      const reply = typeof body.reply === "string" ? body.reply.trim() : "";
      if (!reply || reply.length > 3000) return NextResponse.json({ error: "A reply of 1 to 3000 characters is required." }, { status: 400 });
      data.adminReply = reply;
      data.repliedBy = admin.email;
      data.repliedAt = new Date();
    }
    if (!Object.keys(data).length) return NextResponse.json({ error: "No changes provided." }, { status: 400 });
    await prisma.featureRequest.update({ where: { id: body.requestId }, data });
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: "Could not update this request." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await getAdminAccount(request);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const body = await request.json() as { userId?: unknown };
    if (typeof body.userId !== "string") return NextResponse.json({ error: "Choose a valid account." }, { status: 400 });
    const target = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true, email: true } });
    if (!target) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (target.id === admin.id) return NextResponse.json({ error: "You cannot delete your own signed-in account." }, { status: 400 });
    if (isDefaultAdmin(target.email)) return NextResponse.json({ error: "The default admin account cannot be deleted." }, { status: 400 });

    await prisma.$transaction([
      prisma.adminAuditLog.create({ data: { adminEmail: admin.email, action: "account-delete", targetEmail: target.email, details: "Salah Tracker account and app records deleted." } }),
      prisma.user.delete({ where: { id: target.id } }),
      prisma.adminEmail.deleteMany({ where: { email: target.email.toLowerCase() } }),
    ]);
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Could not delete this account." }, { status: 503 });
  }
}
