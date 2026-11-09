# Current implementation state

This is a code-derived snapshot of the repository as inspected for this documentation task. The dashboard implementation is in `app/dashboard/page.tsx`; UI components are under `app/dashboard/components/`. No source code was changed for this task.

## Browser storage

The application uses browser `localStorage` as its working copy. Daily logs and mark metadata are date-keyed. The following key names/patterns are defined and read or written by the dashboard:

| Key or pattern | Stored data / purpose |
| --- | --- |
| `salah-log-YYYY-MM-DD` | Per-day prayer completion booleans. |
| `salah-marks-YYYY-MM-DD` | Per-prayer mark metadata, including changed timestamp, completed state, marked timestamp, on-time result, and timing context. |
| `salah-synced-marks-YYYY-MM-DD` | Per-day changed timestamps last recorded as synced to Drive. Cleared when the connected Google account changes. |
| `salah-qaza-done` | IDs for completed Qaza candidates. |
| `salah-qaza-done-on` | Completion date keyed by Qaza candidate ID. |
| `salah-start-date` | Local tracking start date. |
| `salah-user-profile` | Display name and image data/URL. Images are limited to under 600,000 characters and accepted as image data URLs or HTTPS URLs when read from backup. |
| `salah-user-profile-custom` | Flag indicating the profile was explicitly customized. |
| `salah-prayer-location` | Prayer-times city, country, and calculation method. Defaults to Karachi, Pakistan, method 1. |
| `salah-times-month-<month>-<encoded location/method>` | Monthly prayer schedule cache by month and configured location/method. |
| `salah-times-<day>-<encoded location/method>` | Day-level prayer schedule cache. |
| `salah-times-request-<day>` | Prevents another prayer-times request for that local day. |
| `salah-times-active-<day>` | Active day schedule cache. |
| `salah-drive-file-id` | Google Drive summary-file ID. |
| `salah-drive-day-file-ids` | JSON map of dates to Drive daily-file IDs. |
| `salah-drive-day-cached-<date>` | Flag that a dated Drive record has been downloaded/cached locally. |
| `salah-drive-email` | Connected Google account email used to scope Drive caches. |
| `salah-drive-fetched-day` | Day of last successful Drive hydration/analysis snapshot. |
| `salah-drive-analysis-version` | Local analysis schema/version marker (`3` for current hydration path). |
| `salah-drive-analysis-<encoded email>` | Cached tracker analysis for an account. |
| `salah-drive-attempt-<encoded email>` | Day on which a Drive check was attempted. |
| `salah-drive-manual-refresh-<encoded email>-<day>` | Daily manual-refresh usage flag. |
| `salah-drive-pending-changes` | Pending change counter used to schedule backup writes. |
| `salah-drive-writes-<encoded email>-<day>` | Daily Drive sync-batch counter. |

The dashboard scans the date-keyed log/mark entries to assemble history and analysis. There is no IndexedDB use in the application code.

## Google Drive files and synchronization

The implemented Drive format is:

- `Salah Tracker Summary.json`: versioned summary containing tracking start date, completed Qaza IDs and completion dates, profile, derived analysis, and the `dailyFileIds` date-to-file-ID index.
- `Salah Tracker YYYY-MM-DD.json`: one daily record containing that date, prayer log, and mark metadata.
- Legacy input `Salah Tracker data.json` is recognized. On migration the code creates the current summary/daily files and renames the legacy file to `Salah Tracker Legacy backup.json`.

Google OAuth requests the `drive.file` scope (alongside OpenID profile/email scopes). The access token is held in React component state for the current page session and passed to Drive requests; the code does not write it to localStorage. A user-authorized connection is requested again after a page reload.

On Drive connection, the app loads the summary and then iterates the summary's daily-file index. A day flagged as cached is read from local storage; otherwise the daily Drive file is downloaded and its contents are saved to the date-keyed log/mark keys. Thus connection may fetch all indexed days that lack the local cache flag. It is not a year-on-demand Qaza history fetch.

The cached account summary is considered fresh for the current local day when the account, summary ID, fetched-day key, and analysis version match. Drive check attempts and manual refreshes are limited to once per local day, with manual refresh tracked separately. Existing dated-record cache flags have no timestamp/expiry; explicit forced refresh bypasses them. Daily prayer-time API calls use the AlAdhan calendar endpoint; the local request flag limits requests to one attempt per local day, while successful month/day schedules are cached by month/date and location/method.

Prayer-time fetching and monthly caching are managed by `hooks/usePrayerTimes.ts`. Prayer timing windows are calculated in `lib/timings.ts`; Isha ends at the following day's Fajr from the cached month schedule. If that next date is not cached (for example, it falls in the next month), the documented fallback is 06:00 local time on the next date (`FALLBACK_NEXT_FAJR_LOCAL_TIME`).

Changes are kept in localStorage first. Pending changes trigger a 45-second debounce before updating the current day's Drive file and summary. The row-level Sync action requests immediate execution of the pending batch. The implementation allows at most four Drive sync batches per account per local day. A batch writes the daily file and then the summary; on a failed write it shows a retry-after-next-change/connection status. The pending counter is decremented only after both writes succeed.

## Qaza behavior as implemented

Outstanding Qaza is derived at render time from each unmarked Fard prayer on every date from the local tracking start date up to (but excluding) today. The list is filtered by IDs stored in `salah-qaza-done`; marking an item done adds its ID and current completion date to the two Qaza keys. It is not backed by individual yearly Qaza records or a separate Qaza statistics file. The current code does not ask for confirmation before deriving an unmarked historical prayer as an outstanding Qaza candidate.

## Baseline checks

Baseline requested for this documentation task, after documentation changes and with source code unchanged:

- `npm run lint` (invoked as `npm.cmd run lint` because PowerShell blocks `npm.ps1`): failed before linting. ESLint 9.39.5 raised `TypeError: Converting circular structure to JSON` while validating the repository ESLint configuration; the circular path included `configs.flat.plugins.react`.
- `npm run build` (invoked as `npm.cmd run build`): passed. Next.js 16.4.5 compiled successfully, TypeScript completed, and static pages were generated for `/`, `/_not-found`, and `/dashboard`.


## Qaza module updates

- Replaced the Qaza dashboard with local IndexedDB totals, prayer balances, oldest-first suggestions (undated records last), per-prayer outstanding lists, history, and statistics views.
- Added year-filtered Qaza history with prayer/status/date/search filters, paging, completion details, affirmation display, and confirmation-gated correction actions.
- Added completion confirmation with an optional affirmation choice. Completion updates the original record, queues a unique operation, maintains completion history, and updates local statistics; repeated completion requests do not create duplicate operations.
- Added ADJUST audit operations. Mistaken outstanding entries become voided and leave statistics; mistaken completions return to outstanding with the original completion retained as reversed history.
- Statistics distinguish originating year from completion year, count source and affirmation totals, and can be reconciled from the local repository.
- Qaza records and operations are kept in IndexedDB. Qaza is not sent to ranking endpoints. Newly written Drive summaries include aggregate Qaza totals only; legacy summary fields are still accepted during restore for compatibility.
- School of thought remains an optional profile setting. lib/qaza/rules.ts provides a preference context hook point without implementing religious rulings. The Qaza interface states that it is a personal tracker, not a source of religious rulings.

These changes do not migrate historical legacy completion IDs into individual IndexedDB Qaza records. Drive sync for the Qaza operation queue is not implemented yet; the queue remains local and pending.
