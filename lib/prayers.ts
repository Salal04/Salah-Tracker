import { Moon, Sparkles, Sun, Sunrise, Sunset } from "lucide-react";
import type { Prayer } from "./types";

export const fard: Prayer[] = [
  { id: "fajr", name: "Fajr", arabic: "الفجر", time: "Before sunrise", icon: Sunrise, kind: "fard", rakaat: "2 rakʿahs" },
  { id: "dhuhr", name: "Dhuhr", arabic: "الظهر", time: "Midday", icon: Sun, kind: "fard", rakaat: "4 rakʿahs" },
  { id: "asr", name: "Asr", arabic: "العصر", time: "Afternoon", icon: Sun, kind: "fard", rakaat: "4 rakʿahs" },
  { id: "maghrib", name: "Maghrib", arabic: "المغرب", time: "After sunset", icon: Sunset, kind: "fard", rakaat: "3 rakʿahs" },
  { id: "isha", name: "Isha", arabic: "العشاء", time: "Night", icon: Moon, kind: "fard", rakaat: "4 rakʿahs" },
];

export const nawafil: Prayer[] = [
  { id: "fajr-sunnah", name: "Fajr Sunnah", arabic: "سنة الفجر", time: "Before Fajr", icon: Sunrise, kind: "sunnah", rakaat: "2 rakʿahs" },
  { id: "dhuhr-sunnah", name: "Dhuhr Sunnah", arabic: "سنة الظهر", time: "Around Dhuhr", icon: Sun, kind: "sunnah", rakaat: "2 + 2 rakʿahs" },
  { id: "asr-sunnah", name: "Asr Sunnah", arabic: "سنة العصر", time: "Before Asr", icon: Sun, kind: "sunnah", rakaat: "4 rakʿahs" },
  { id: "maghrib-sunnah", name: "Maghrib Sunnah", arabic: "سنة المغرب", time: "After Maghrib", icon: Sunset, kind: "sunnah", rakaat: "2 rakʿahs" },
  { id: "isha-sunnah", name: "Isha Sunnah", arabic: "سنة العشاء", time: "After Isha", icon: Moon, kind: "sunnah", rakaat: "2 rakʿahs" },
  { id: "witr", name: "Witr", arabic: "الوتر", time: "After Isha", icon: Moon, kind: "nafl", rakaat: "1, 3, 5 or more" },
  { id: "tahajjud", name: "Tahajjud", arabic: "التهجد", time: "Last third of night", icon: Sparkles, kind: "nafl", rakaat: "As you are able" },
];

export const prayersByFard: Record<string, Prayer[]> = {
  fajr: [nawafil[0]],
  dhuhr: [nawafil[1]],
  asr: [nawafil[2]],
  maghrib: [nawafil[3]],
  isha: [nawafil[4], nawafil[5]],
};

export const otherNawafil: Prayer[] = nawafil.filter((prayer) => prayer.id === "tahajjud");

export const sunnahMuakkadahByFard: Record<string, Prayer[]> = {
  fajr: [nawafil[0]],
  dhuhr: [nawafil[1]],
  asr: [nawafil[2]],
  maghrib: [nawafil[3]],
  isha: [nawafil[4]],
};

export const witrPrayer = nawafil.find((prayer) => prayer.id === "witr")!;
