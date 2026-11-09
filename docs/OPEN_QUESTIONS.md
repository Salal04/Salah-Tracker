# Open questions

- `APP_NOTES.md` describes a per-user summary, daily index, daily files, a Qaza balance file, and yearly Qaza files, while `QAZA_MODULE_SPEC.md` specifies yearly individual-record files plus a separate statistics file. Which file layout is authoritative, and should Qaza completions also update the daily prayer record/index?
- The notes describe recording an oath or no oath and a warning that invokes God as witness; the Qaza spec calls affirmation voluntary, allows completion without affirmation, and says it must not be presented as a compulsory religious oath. Should the prayer-mark flow use a non-oath affirmation choice, and what exact user-facing wording is intended?
- `APP_NOTES.md` calls for loading relevant daily records when Qaza history is opened, whereas the Qaza spec stores and fetches history by year and says not to load all historical Qaza records on dashboard open. Should history derive from daily prayer logs or from dedicated yearly Qaza records?
- The notes propose a limit of five prayer syncs plus one extra sync, while `README.md` and the implemented code describe a limit of four sync batches per day with pending changes batched. Which quota behavior should future implementation follow?
- The Qaza spec requires user confirmation before converting an unmarked prayer into Qaza; current code derives outstanding Qaza from every unmarked Fard prayer since the tracking start date. Should automatic detection remain a review prompt, and how should users confirm, dismiss, or defer each candidate?
- The Qaza spec requires IndexedDB caching, an offline operation queue, version/ETag conflict handling, retry/backoff, and recovery. Current implementation uses localStorage and has no Qaza-specific queue. Are these requirements intended for a later phase, or should an existing localStorage/Drive design be extended first?
- The notes specify user profile fields such as gender, location, and school of thought, but the implemented profile stores only a display name and image; prayer location/calculation method are separate settings. Which profile fields are intended and should any be backed up?





## Decisions (authoritative, override APP_NOTES.md where they conflict)

1. File layout: follow QAZA_MODULE_SPEC.md. Yearly qaza-record-YYYY.json files are the source of truth and qaza-statistics.json is a derived projection. No separate "Qaza balance" file. The per-user summary keeps only aggregate Qaza totals. A Qaza completion does NOT edit the daily prayer record or the daily index; it updates only the original yearly Qaza record, the statistics file and the summary totals.

2. Oath: keep the two-option mark flow (with affirmation / without affirmation), but it is strictly voluntary and never presented as compulsory. Wording is gentle: a short reminder that Allah is aware of our prayers, then "Mark with affirmation" or "Mark without affirmation". Do not use "I swear" phrasing. Store as affirmation: "oath" | "none". Same wording style for Qaza completion.

3. Qaza history: derive from the yearly Qaza records only, never from daily prayer logs. Opening history loads only the selected year. Daily logs are used only by automatic detection (previous-day review).

4. Sync quota: follow APP_NOTES.md (5 fard slots + 1 nawafil slot per day) and replace the current 4-batch limit. Writes are still batched. Config lives in one object so numbers can change. Qaza yearly files and statistics are synced through the offline queue and do not use the daily-prayer quota (they are written only when changed).

5. Automatic detection: stays as a review prompt only. Each candidate gets Yes (offered, no Qaza), No (create outstanding Qaza) or Not sure (stays pending). Pending items never count as outstanding. Existing legacy "missed" days become pending confirmation.

6. Infrastructure: implement IndexedDB cache, offline queue, ETag, backoff and recovery now, in Phase 4-5 of the prompt pack. Extend the localStorage design only for daily records and settings; do not build a localStorage Qaza queue.

7. Profile: store display name, picture, gender (optional), school of thought (optional) and location (city, country, linked to the prayer location). Back all of them up in the Drive summary. Calculation method stays a separate prayer-time setting.