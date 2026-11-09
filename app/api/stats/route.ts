import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

type GoogleAccount = { sub?: string; email?: string; email_verified?: boolean };
type AggregateStats = {
  totalFard: number;
  onTimeFard: number;
  daysWithFard: number;
  completeFardDays: number;
  bestStreakDays: number;
};

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000;

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid stats payload." }, { status: 400 });
    }

    const { accessToken, stats } = payload as { accessToken?: unknown; stats?: unknown };
    if (typeof accessToken !== "string" || accessToken.length < 20 || accessToken.length > 10_000 || !stats || typeof stats !== "object") {
      return NextResponse.json({ error: "A valid Google session and aggregate stats are required." }, { status: 400 });
    }

    const candidate = stats as Partial<AggregateStats>;
    const fields: (keyof AggregateStats)[] = ["totalFard", "onTimeFard", "daysWithFard", "completeFardDays", "bestStreakDays"];
    if (!fields.every((field) => isCount(candidate[field]))) {
      return NextResponse.json({ error: "Stats must contain non-negative aggregate counts." }, { status: 400 });
    }
    const aggregateStats: AggregateStats = {
      totalFard: candidate.totalFard!,
      onTimeFard: candidate.onTimeFard!,
      daysWithFard: candidate.daysWithFard!,
      completeFardDays: candidate.completeFardDays!,
      bestStreakDays: candidate.bestStreakDays!,
    };

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!profileResponse.ok) return NextResponse.json({ error: "Google session expired. Reconnect Drive." }, { status: 401 });

    const account = await profileResponse.json() as GoogleAccount;
    if (!account.sub || !account.email || account.email_verified !== true) {
      return NextResponse.json({ error: "A verified Google account is required." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { googleSubject: account.sub }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "Sign in before saving stats." }, { status: 401 });

    await prisma.userStats.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...aggregateStats },
      update: aggregateStats,
    });

    console.info("[stats] Aggregate prayer stats saved; Qaza and daily records were excluded.");
    return NextResponse.json({ saved: true });
  } catch {
    console.error("[stats] Aggregate stats could not be saved; credentials were not logged.");
    return NextResponse.json({ error: "Could not save aggregate stats to Neon." }, { status: 503 });
  }
}
