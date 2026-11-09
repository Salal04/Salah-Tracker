import type { QazaRecord } from "./types";

export function getSuggestedQaza(records: QazaRecord[], limit = 3): QazaRecord[] {
  return records.filter((r) => r.status === "outstanding").sort((a, b) => {
    if (a.missedDate === null && b.missedDate !== null) return 1;
    if (b.missedDate === null && a.missedDate !== null) return -1;
    return (a.missedDate || "").localeCompare(b.missedDate || "") || a.id.localeCompare(b.id);
  }).slice(0, limit);
}
