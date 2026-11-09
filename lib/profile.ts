import type { SchoolOfThought, UserProfile } from "./types";

const schoolsOfThought: SchoolOfThought[] = ["Hanafi", "Shafi'i", "Maliki", "Hanbali", "Other", "Prefer not to say"];

export function normalizeUserProfile(value: unknown): UserProfile | null {
  if (!value || typeof value !== "object") return null;
  const profile = value as Partial<UserProfile>;
  if (typeof profile.name !== "string" || !profile.name.trim()) return null;
  const image = typeof profile.image === "string" && profile.image.length < 600_000 && (profile.image.startsWith("data:image/") || profile.image.startsWith("https://")) ? profile.image : "";
  const gender = typeof profile.gender === "string" && profile.gender.trim() ? profile.gender.trim().slice(0, 60) : undefined;
  const schoolOfThought = schoolsOfThought.includes(profile.schoolOfThought as SchoolOfThought) ? profile.schoolOfThought : undefined;
  const city = typeof profile.location?.city === "string" ? profile.location.city.trim().slice(0, 100) : "";
  const country = typeof profile.location?.country === "string" ? profile.location.country.trim().slice(0, 100) : "";
  const location = city && country ? { city, country } : undefined;
  return { name: profile.name.trim().slice(0, 40), image, ...(gender ? { gender } : {}), ...(schoolOfThought ? { schoolOfThought } : {}), ...(location ? { location } : {}) };
}
