CREATE TABLE "google_drive_credentials" (
    "userId" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "summaryFileId" TEXT,
    "lastDriveStatsSyncDay" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_drive_credentials_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "google_drive_credentials"
    ADD CONSTRAINT "google_drive_credentials_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
