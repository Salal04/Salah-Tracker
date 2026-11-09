import "server-only";
import type { NextRequest } from "next/server";
import { getGoogleSessionUserId } from "@/lib/auth/google-session";
import { prisma } from "@/lib/db/prisma";

export const DEFAULT_ADMIN_EMAIL = "salalshabbir242@gmail.com";

export function isDefaultAdmin(email: string) {
  return email.trim().toLowerCase() === (process.env.DEFAULT_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
}

export async function getSessionAccount(request: NextRequest) {
  const userId = getGoogleSessionUserId(request);
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
}

export async function getAdminAccount(request: NextRequest) {
  const account = await getSessionAccount(request);
  if (!account) return null;
  if (isDefaultAdmin(account.email)) return account;
  const grant = await prisma.adminEmail.findUnique({ where: { email: account.email.toLowerCase() } });
  return grant ? account : null;
}

export function subscriptionState(expiresAt: Date | null) {
  if (!expiresAt) return "free" as const;
  return expiresAt.getTime() > Date.now() ? "active" as const : "expired" as const;
}
