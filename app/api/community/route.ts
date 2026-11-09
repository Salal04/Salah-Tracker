import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [settings, quotes, resources, announcements] = await Promise.all([
      prisma.contentSettings.findUnique({ where: { id: "main" } }),
      prisma.dailyQuote.findMany({ where: { active: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, text: true, attribution: true } }),
      prisma.sharedResource.findMany({ where: { published: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, title: true, description: true, url: true, createdAt: true } }),
      prisma.announcement.findMany({ where: { published: true }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 30, select: { id: true, title: true, body: true, updatedAt: true } }),
    ]);
    const mode = settings?.quoteMode === "fixed" ? "fixed" : "rotating";
    const fixed = quotes.find((quote) => quote.id === settings?.fixedQuoteId);
    const dayNumber = Math.floor(Date.now() / 86_400_000);
    const quote = fixed || (quotes.length ? quotes[dayNumber % quotes.length] : null);
    return NextResponse.json({ quote, quotes, quoteMode: mode, quoteDate: new Date().toISOString().slice(0, 10), resources, announcements }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Community content is unavailable. Please try again." }, { status: 503 });
  }
}
