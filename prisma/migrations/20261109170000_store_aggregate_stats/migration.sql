-- Keep only account identity in Neon; tracker details and Qaza remain in existing storage.
ALTER TABLE "users"
    DROP COLUMN "googleDriveAccessTokenEncrypted",
    DROP COLUMN "googleDriveRefreshTokenEncrypted",
    DROP COLUMN "googleDriveTokenExpiresAt";

CREATE TABLE "user_stats" (
    "userId" TEXT NOT NULL,
    "totalFard" INTEGER NOT NULL DEFAULT 0,
    "onTimeFard" INTEGER NOT NULL DEFAULT 0,
    "daysWithFard" INTEGER NOT NULL DEFAULT 0,
    "completeFardDays" INTEGER NOT NULL DEFAULT 0,
    "bestStreakDays" INTEGER NOT NULL DEFAULT 0,
    "rankingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "user_stats"
    ADD CONSTRAINT "user_stats_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
