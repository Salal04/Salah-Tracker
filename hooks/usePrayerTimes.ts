"use client";

import { useEffect, useState } from "react";
import type { DayTimings, MonthTimings, PrayerLocation } from "@/lib/types";
import { dateKey } from "@/lib/dates";
import { localKeys, localStore, readJson, writeJson } from "@/lib/storage/local";

export const usePrayerTimes = (ready: boolean, day: Date, location: PrayerLocation) => {
  const [todayTimings, setTodayTimings] = useState<DayTimings | null>(null);
  const [monthTimings, setMonthTimings] = useState<MonthTimings | null>(null);
  const [timingStatus, setTimingStatus] = useState("Loading prayer times?");

  useEffect(() => {
    if (!ready || dateKey(day) !== dateKey(new Date())) return;
    const today = dateKey(new Date());
    const month = today.slice(0, 7);
    const cacheKey = localKeys.timesMonth(month, location);
    const cached = readJson<MonthTimings | null>(cacheKey, null);
    if (cached) {
      try {
        const todaySchedule = cached.days?.find((entry) => entry.date === today);
        if (cached.month === month && todaySchedule?.timings?.Fajr) {
          setMonthTimings(cached);
          setTodayTimings(todaySchedule);
          setTimingStatus(`Monthly times for ${location.city}, ${location.country} - saved in this browser`);
          return;
        }
      } catch { /* Fetch a replacement if the cached response is malformed. */ }
    }
    if (localStore.getItem(localKeys.timesRequest(today))) {
      let active: DayTimings | null = todayTimings;
      if (!active) active = readJson<DayTimings | null>(localKeys.timesActive(today), null);
      if (active) {
        setTodayTimings(active);
        setTimingStatus(`Today's request was already used. Showing saved daily times for ${active.location.city}, ${active.location.country}; monthly view loads when available.`);
      } else setTimingStatus("Today's one timing request was already used; the monthly schedule can load tomorrow.");
      return;
    }
    setTodayTimings(null);
    setMonthTimings(null);
    localStore.setItem(localKeys.timesRequest(today), "requested");
    setTimingStatus(`Fetching this month's times for ${location.city}...`);
    const query = new URLSearchParams({ city: location.city, country: location.country, method: String(location.method), iso8601: "true" });
    const [year, monthNumber] = month.split("-");
    fetch(`https://api.aladhan.com/v1/calendarByCity/${year}/${Number(monthNumber)}?${query.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Prayer-time service is unavailable.");
        const payload = await response.json() as { code?: number; data?: Array<{ date?: { gregorian?: { date?: string } }; timings?: Record<string, string>; meta?: { timezone?: string } }> };
        if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("Could not read this month's prayer times for this location.");
        const days = payload.data.flatMap((entry) => {
          const dateText = entry.date?.gregorian?.date;
          const source = entry.timings;
          if (!dateText || !source?.Fajr || !source?.Sunrise || !source?.Dhuhr || !source?.Asr || !source?.Maghrib || !source?.Isha) return [];
          const [dayNumber, monthValue, yearValue] = dateText.split("-");
          const date = `${yearValue}-${monthValue}-${dayNumber}`;
          return [{ date, location, timezone: entry.meta?.timezone || "", timings: source }];
        });
        const schedule: MonthTimings = { month, location, timezone: days[0]?.timezone || "", days };
        const todaySchedule = days.find((entry) => entry.date === today);
        if (!todaySchedule) throw new Error("Could not find today in this month's prayer schedule.");
        writeJson(cacheKey, schedule);
        writeJson(localKeys.timesActive(today), todaySchedule);
        writeJson(localKeys.times(today, location), todaySchedule);
        setMonthTimings(schedule);
        setTodayTimings(todaySchedule);
        setTimingStatus(`Monthly times for ${location.city}, ${location.country} - saved in this browser`);
      })
      .catch((error: unknown) => setTimingStatus(error instanceof Error ? error.message : "Prayer times could not be loaded."));
  }, [ready, day, location]);

  return { todayTimings, monthTimings, timingStatus, setTimingStatus };
};
