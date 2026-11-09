import { NextRequest, NextResponse } from "next/server";
import { getAdminAccount } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const admin = await getAdminAccount(request);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const [settings, quotes, resources, announcements] = await Promise.all([
      prisma.contentSettings.upsert({ where: { id: "main" }, create: { id: "main" }, update: {} }),
      prisma.dailyQuote.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      prisma.sharedResource.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      prisma.announcement.findMany({ orderBy: [{ updatedAt: "desc" }, { id: "desc" }] }),
    ]);
    return NextResponse.json({ settings, quotes, resources, announcements });
  } catch {
    return NextResponse.json({ error: "Content manager data is unavailable. Apply database migrations and retry." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminAccount(request);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const data = await request.json() as { action?: unknown; text?: unknown; attribution?: unknown; mode?: unknown; quoteId?: unknown; title?: unknown; description?: unknown; url?: unknown; bodyText?: unknown };
    if (data.action === "add-quote") {
      const text = typeof data.text === "string" ? data.text.trim() : "";
      const attribution = typeof data.attribution === "string" ? data.attribution.trim() : "";
      if (text.length < 5 || text.length > 600 || attribution.length > 160) return NextResponse.json({ error: "Quote must be 5–600 characters; attribution is limited to 160." }, { status: 400 });
      const quote = await prisma.dailyQuote.create({ data: { text, attribution: attribution || null } });
      await prisma.adminAuditLog.create({ data: { adminEmail: admin.email, action: "content-quote-add", targetEmail: "all-users", details: `Quote ${quote.id} added.` } });
      return NextResponse.json({ saved: true, quote });
    }
    if (data.action === "quote-settings") {
      if (data.mode !== "fixed" && data.mode !== "rotating") return NextResponse.json({ error: "Choose fixed or rotating quote mode." }, { status: 400 });
      const quoteId = typeof data.quoteId === "string" ? data.quoteId : "";
      if (data.mode === "fixed" && !await prisma.dailyQuote.findFirst({ where: { id: quoteId, active: true }, select: { id: true } })) return NextResponse.json({ error: "Choose an active quote for fixed mode." }, { status: 400 });
      await prisma.contentSettings.upsert({ where: { id: "main" }, create: { id: "main", quoteMode: data.mode, fixedQuoteId: data.mode === "fixed" ? quoteId : null }, update: { quoteMode: data.mode, fixedQuoteId: data.mode === "fixed" ? quoteId : null } });
      await prisma.adminAuditLog.create({ data: { adminEmail: admin.email, action: "content-quote-mode", targetEmail: "all-users", details: data.mode === "fixed" ? `Fixed quote: ${quoteId}` : "Daily quote rotates by UTC date." } });
      return NextResponse.json({ saved: true });
    }
    if (data.action === "add-resource") {
      const title = typeof data.title === "string" ? data.title.trim() : "";
      const description = typeof data.description === "string" ? data.description.trim() : "";
      const rawUrl = typeof data.url === "string" ? data.url.trim() : "";
      let url: URL;
      try { url = new URL(rawUrl); } catch { return NextResponse.json({ error: "Enter a valid HTTPS link." }, { status: 400 }); }
      if (title.length < 2 || title.length > 140 || description.length > 600 || url.protocol !== "https:" || rawUrl.length > 2048) return NextResponse.json({ error: "Enter a title, an optional description, and a valid HTTPS link." }, { status: 400 });
      const resource = await prisma.sharedResource.create({ data: { title, description: description || null, url: url.toString() } });
      await prisma.adminAuditLog.create({ data: { adminEmail: admin.email, action: "content-resource-add", targetEmail: "all-users", details: `Resource ${resource.id} published.` } });
      return NextResponse.json({ saved: true, resource });
    }
    if (data.action === "add-announcement") {
      const title = typeof data.title === "string" ? data.title.trim() : "";
      const body = typeof data.bodyText === "string" ? data.bodyText.trim() : "";
      if (title.length < 3 || title.length > 160 || body.length < 5 || body.length > 3000) return NextResponse.json({ error: "Add a 3–160 character title and 5–3000 characters of announcement text." }, { status: 400 });
      const announcement = await prisma.announcement.create({ data: { title, body } });
      await prisma.adminAuditLog.create({ data: { adminEmail: admin.email, action: "content-announcement-add", targetEmail: "all-users", details: `Announcement ${announcement.id} published.` } });
      return NextResponse.json({ saved: true, announcement });
    }
    return NextResponse.json({ error: "Unknown content action." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Could not save this content." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminAccount(request);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const data = await request.json() as { action?: unknown; id?: unknown; published?: unknown; active?: unknown };
    if (typeof data.id !== "string") return NextResponse.json({ error: "Invalid content update." }, { status: 400 });
    if (data.action === "quote-active" && typeof data.active === "boolean") {
      await prisma.dailyQuote.update({ where: { id: data.id }, data: { active: data.active } });
      if (!data.active) await prisma.contentSettings.updateMany({ where: { id: "main", fixedQuoteId: data.id }, data: { quoteMode: "rotating", fixedQuoteId: null } });
    } else if (data.action === "resource-published" && typeof data.published === "boolean") {
      await prisma.sharedResource.update({ where: { id: data.id }, data: { published: data.published } });
    } else if (data.action === "announcement-published" && typeof data.published === "boolean") {
      await prisma.announcement.update({ where: { id: data.id }, data: { published: data.published } });
    } else return NextResponse.json({ error: "Unknown content update." }, { status: 400 });
    await prisma.adminAuditLog.create({ data: { adminEmail: admin.email, action: `content-${String(data.action)}`, targetEmail: "all-users", details: `Content item ${data.id} updated.` } });
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: "Could not update this content." }, { status: 503 });
  }
}
