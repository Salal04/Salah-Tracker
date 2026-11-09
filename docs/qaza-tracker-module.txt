# Salah Tracker – Qaza Management Module

Feature Specification v1.0

## 1. Module Overview

The Qaza Management Module will allow users to track missed obligatory (Fard) prayers, maintain individual Qaza records, record completed Qaza prayers, and monitor their outstanding balance and progress.

The module will consist of five main components:

1. Qaza Dashboard – Displays outstanding Qaza and overall progress.
2. Qaza Records – Maintains individual missed prayer records.
3. Qaza Management – Allows users to add and manage Qaza records.
4. Qaza Completion – Records completed Qaza prayers.
5. Qaza Statistics – Displays prayer-wise, yearly, and overall statistics.

### Module navigation

Dashboard

Balance and progress

Qaza History

Individual records

Add Qaza

Manual backlog entry

Statistics

Progress and trends

## 2. Qaza Dashboard

The dashboard should provide an immediate overview of the user's outstanding Qaza prayers.

### 2.1 Overall summary

Display the following metrics:

- Total Qaza added.
- Total Qaza completed.
- Total outstanding Qaza.
- Total Qaza records.
- Overall completion percentage.

Completion formula:

\\[ Completion = \frac{Completed\ Qaza}{Total\ Qaza\ Added}\times100 \\]

Example:

Your Qaza Overview

# 65

Added

# 25

Completed

# 40

Remaining

Completion progress\
38.5%

Illustrative figures

### 2.2 Prayer-wise outstanding balance

Display outstanding Qaza separately for each obligatory prayer.

| Prayer  | Outstanding |
| ------- | ----------- |
| Fajr    | 8           |
| Dhuhr   | 10          |
| Asr     | 7           |
| Maghrib | 5           |
| Isha    | 10          |
| Total   | 40          |

Users should be able to select a prayer and view its corresponding outstanding records.

### 2.3 Suggested Qaza prayers

The dashboard should recommend 2–3 outstanding Qaza prayers.

Features:

- Prioritize the oldest outstanding records.
- Allow users to complete a suggested prayer directly.
- Allow users to select another prayer manually.
- Avoid suggesting already completed records.

## 3. Qaza Record Management

This is the core component of the module.

Every individually tracked missed Fard prayer should have a unique record.

### 3.1 Individual record structure

| Field         | Description                                     |
| ------------- | ----------------------------------------------- |
| `id`          | Unique record identifier                        |
| `prayer`      | Fajr, Dhuhr, Asr, Maghrib, or Isha              |
| `missedDate`  | Original missed prayer date                     |
| `detectedAt`  | Date and time the application identified it     |
| `source`      | Automatic detection or manual entry             |
| `status`      | Outstanding, Completed, or Pending Confirmation |
| `offeredAt`   | Date and time the Qaza was offered              |
| `affirmation` | Whether the user selected affirmation           |
| `completedAt` | Completion timestamp                            |
| `year`        | Original missed prayer year                     |

### 3.2 Record statuses

Outstanding

Pending

The Qaza record exists, but the prayer has not yet been offered.

Completed

Completed

The user has confirmed offering the Qaza prayer.

Pending Confirmation

Review required

The application identified an unmarked prayer, but the user has not confirmed whether it was missed.

Important: An unmarked prayer must not automatically become a confirmed Qaza. User confirmation is required.

## 4. First-Time Application Setup

The application must handle users who have existing Qaza prayers before installing Salah Tracker.

### 4.1 Initial setup

When a user starts using the application for the first time:

1. Establish the application tracking start date.
2. Do not automatically generate Qaza records for previous dates.
3. Allow users to enter their existing Qaza backlog manually.
4. Start automatic daily prayer tracking from the setup date.

### 4.2 Initial Qaza setup options

Users should be able to choose:

- I have no previous Qaza.
- I want to enter my existing Qaza.
- I will add my Qaza later.

### 4.3 Manual backlog entry

Users should be able to enter existing Qaza quantities prayer-wise.

Example:

```
{
  "source": "manual",
  "prayer": "fajr",
  "quantity": 20,
  "missedDate": null
}
```

If the exact missed dates are unknown, the application must not generate artificial dates. These records should be treated as undated backlog entries.

## 5. Automatic Missed Prayer Detection

The application should review previous daily prayer records to identify unmarked Fard prayers.

### 5.1 Detection workflow

Day 1 – November 5

Fajr prayer was not marked.

Day 2 – November 6

Application identifies an unmarked Fajr prayer.

User confirmation required

Did you offer this prayer?

Yes

Do not create Qaza.

No

Create Qaza record.

The confirmation flow should also support a third option: Not sure. Such records remain pending until reviewed.

### 5.2 Detection rules

- Only Fard prayers are included.
- Sunnah Muakkadah prayers are excluded.
- Nawafil are excluded.
- Witr is excluded from this Fard-only module.
- Previously processed dates must not be processed again.
- Isha must follow its correct prayer-date window, including after midnight.
- Historical daily records must not be modified automatically.
- Maintain a processed-date or review-state indicator to prevent repeated confirmation prompts.

## 6. Manual Qaza Management

Users must be able to add Qaza independently of automatic detection.

### Supported features

- Add one Qaza prayer.
- Add multiple Qaza prayers.
- Select prayer type.
- Select the original missed date, if known.
- Add undated Qaza backlog.
- Select the original year.
- Review entries before saving.
- Add Qaza quantities in bulk.

For example, adding 20 Fajr Qaza should create 20 individually trackable outstanding records, linked through a common import operation ID.

## 7. Qaza Completion Workflow

When a user offers an outstanding Qaza prayer, the application should provide a completion workflow.

### Completion steps

1. Select an outstanding Qaza record.
2. Confirm that the prayer has been offered.
3. Select an affirmation option or complete without affirmation.
4. Save the completion.
5. Update the corresponding yearly Qaza record.
6. Update Qaza statistics.
7. Update the local cache.
8. Add the synchronization operation to the offline queue.

### Completion confirmation interface

Complete Qaza Prayer

Selected Qaza

# Fajr

Original missed date: November 5, 2026

Confirmation\
Have you offered this Qaza prayer?

Yes, I have offered it

Affirmation options

- With affirmation
- Without affirmation

  Illustrative interface

### Completion rules

- A completed record must not be counted as outstanding.
- Repeated completion requests must not create duplicate events.
- Completed records must not be silently deleted or reverted.
- Corrections should be handled through explicit adjustment events.
- Store both the original missed date and the actual completion timestamp.

## 8. Year-wise Qaza History

Qaza records should be stored in separate yearly files.

```
qaza-record-2026.json
qaza-record-2027.json
qaza-record-2028.json
```

### History features

- View Qaza records by year.
- Filter by prayer.
- Filter by status.
- Filter by original missed date.
- View outstanding Qaza.
- View completed Qaza.
- Search individual records.
- View completion dates.
- View affirmation history.

Important: If a user completes a Qaza prayer in 2027 that originally belonged to 2026, the original 2026 record must be updated. A duplicate record must not be created in 2027.

## 9. Qaza Statistics

Maintain a separate `qaza-statistics.json` file for fast dashboard access.

### 9.1 Overall statistics

- Total Qaza added.
- Total Qaza completed.
- Total outstanding.
- Prayer-wise outstanding balance.
- Completion percentage.
- Manually added versus automatically detected Qaza.
- Affirmation-wise completion counts.

### 9.2 Year-wise statistics

- Qaza originating in each year.
- Qaza completed during each year.
- Outstanding Qaza originating in each year.

### 9.3 Prayer-wise statistics

| Prayer  | Added | Completed | Remaining |
| ------- | ----- | --------- | --------- |
| Fajr    | 20    | 12        | 8         |
| Dhuhr   | 15    | 5         | 10        |
| Asr     | 12    | 5         | 7         |
| Maghrib | 10    | 5         | 5         |
| Isha    | 8     | 0         | 8         |

Illustrative statistics

Important distinction: Qaza originating in a particular year and Qaza completed during a particular year are two different metrics. They must be calculated separately.

## 10. Storage Architecture

Google Drive will remain the primary storage, while IndexedDB will provide local caching and offline support.

Google Drive – Qaza storage

Qaza Module

`qaza-statistics.json`

`qaza-record-2026.json`

`qaza-record-2027.json`

`qaza-record-2028.json`

IndexedDB – Local cache

- Qaza statistics.
- Current-year Qaza records.
- Pending Qaza operations.
- Processed-date tracking.
- Version and synchronization metadata.

### 10.1 Data retrieval strategy

| Action              | Drive operation                    |
| ------------------- | ---------------------------------- |
| Open Qaza dashboard | Use local cache if valid           |
| Complete Qaza       | Update local queue first           |
| Open Qaza history   | Fetch requested year if not cached |
| Open another year   | Fetch that year only               |
| Update statistics   | Write only when changed            |
| Rebuild statistics  | Read yearly records when necessary |

The application should not fetch all historical Qaza records every time the user opens the dashboard.

## 11. Synchronization and Data Integrity

The Qaza module must follow the application's offline-first architecture.

### Required features

- Optimistic UI updates.
- IndexedDB offline queue.
- Batch writes where supported.
- Exponential backoff retries.
- ETag/version checking.
- Unique operation IDs.
- Duplicate prevention.
- Partial synchronization recovery.
- Statistics reconciliation from yearly records.

### Example synchronization operation

```
{
  "operationId": "op-qaza-001",
  "type": "COMPLETE_QAZA",
  "recordId": "qaza-001",
  "year": 2026,
  "status": "pending"
}
```

The operation should be considered fully synchronized only after the yearly record and statistics projection have both been successfully reconciled.

Google Drive does not provide atomic transactions across multiple files, so the application must maintain a recoverable operation log.

## 12. Privacy and Religious Considerations

- Qaza records must remain private by default.
- Individual missed prayer records must never be published on leaderboards.
- Previous prayers must not automatically be classified as Qaza.
- Unmarked prayers require user confirmation.
- Affirmation must be voluntary and must not be presented as a compulsory religious oath.
- School-of-thought-specific rules should be configurable.
- Users must be able to correct accidental entries.
- The application should be presented as a personal prayer-tracking tool, not a source of religious rulings.

## 13. Complete Feature Checklist

Use this checklist during development.

Development checklist

0/37

Dashboard

Overall Qaza balance

Prayer-wise outstanding count

Completion progress

Suggested 2–3 Qaza prayers

Qaza Records

Unique individual records

Original missed date

Detection timestamp

Outstanding / Completed / Pending states

Year-wise history

Prayer and status filters

Qaza Management

First-time backlog setup

Manual Qaza addition

Bulk quantity addition

Undated backlog support

Explicit correction

Automatic Detection

Previous-day review

User confirmation

Duplicate detection

Isha after-midnight handling

Processed-date tracking

Completion

Select outstanding record

Completion confirmation

Affirmation choice

Completion timestamp

Original yearly record update

Statistics

Overall totals

Prayer-wise balance

Year-wise statistics

Completion percentage

Manual vs automatic records

Storage and Synchronization

Year-wise Google Drive files

Separate statistics file

IndexedDB caching

Offline operation queue

Batch writes

ETag conflict handling

Recovery and reconciliation

&#x20;Copy checklist

## 14. Recommended Implementation Phases

| Phase | Development task                              |
| ----- | --------------------------------------------- |
| 1     | Qaza JSON schemas and data models             |
| 2     | Qaza Dashboard UI                             |
| 3     | Manual backlog entry                          |
| 4     | Individual Qaza record management             |
| 5     | Previous-day detection and confirmation       |
| 6     | Qaza completion workflow                      |
| 7     | Statistics calculation                        |
| 8     | Google Drive integration                      |
| 9     | IndexedDB caching and offline synchronization |
| 10    | Recovery, testing and edge cases              |

## Final Architectural Decisions

1. Year-wise individual Qaza records will be the source of truth.
2. `qaza-statistics.json` will be a derived projection for fast dashboard access.
3. IndexedDB will cache frequently accessed Qaza data.
4. Previous prayer history will never be assumed to be missed automatically.
5. Every Qaza completion will be recorded as an auditable operation.
6. Historical data will only be fetched when required, not on every application launch.

Recommended project documentation filename: `QAZA_MODULE_SPEC.md`