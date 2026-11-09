# Salah Tracker

A Next.js daily prayer tracker for the five fard salah and selected sunnah and nafl prayers.

## Getting started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The public welcome page is at `/`; open `/dashboard` to use the prayer tracker.

Prayer check-offs are saved locally and backed up to Google Drive. The app keeps a dated `Salah Tracker YYYY-MM-DD.json` file for each day with records, plus a `Salah Tracker Summary.json` file with Qaza/profile information, ranking analysis, and a date-to-file-ID index. The index lets the app fetch a date's record directly after loading the summary. Fetched daily records are cached in local storage and reused; **Refresh from Drive** forces a fresh read of manual Drive changes and is limited to once per day. Changes update the current day's file and the summary together. Local storage is the working copy, so marking prayers and Qaza works without a Drive call. Pending changes sync in a 45-second batch, with an app limit of four sync batches per day. Google access tokens stay in memory and need a new user-authorized connection when the page is reopened.

## Google Drive setup

1. In Google Cloud Console, create a project and enable the Google Drive API.
2. Configure the OAuth consent screen and create an OAuth client ID for a **Web application**.
3. Add your app origin to **Authorized JavaScript origins** (for local development, `http://localhost:3000`).
4. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to that client ID.
5. Restart `npm run dev`, then choose **Continue with Google** in the app.

The tracker start date is recorded locally and included in the Drive summary. On an existing install, the app migrates saved daily records into dated files and moves the old backup to `Salah Tracker Legacy backup.json`. Each daily file contains that date's prayer log and mark metadata. The summary contains versioned analysis: lifetime fard/sunnah/nafl totals, completed Qaza, full five-prayer days, best streak per prayer, and daily summaries. Timing comparisons are retained internally for possible future leaderboard use and are not shown in the interface. The app requests the `drive.file` permission for files it creates.

Monthly prayer times use AlAdhan's city calendar endpoint. The schedule is cached in browser local storage, so the app uses at most one API request per local calendar day and later opens in that month need no request. The dashboard shows the full current-month table and today's times. City and calculation-method changes apply when a new schedule can be fetched. Each prayer can be marked during the current day only. The app shows the mark time and stores the prayer window and timing context internally; this records when the user tapped the button, not proof of when prayer was performed. A prayer-row **Sync** button is enabled only for a changed, unsynced record and uploads the current pending batch to Drive.

## Scripts

- `npm run dev` â€” start the development server
- `npm run build` â€” create a production build
- `npm run start` â€” serve the production build
- `npm run lint` â€” run ESLint

The dashboard is split into Today, Prayer times, Qaza, and Insights tabs. Prayer schedules are shown only inside Prayer times; on mobile, use the fixed bottom navigation. Dashboard sections are separate components under `app/dashboard/components/`.


A display name is required to use the tracker; a profile photo is optional. Users can edit both from the profile button in the dashboard header. Google account name and picture are used as initial values after Drive connection when available. Profile edits stay in browser storage and are included in the users Drive backup when connected. Uploaded photos are resized before saving.

