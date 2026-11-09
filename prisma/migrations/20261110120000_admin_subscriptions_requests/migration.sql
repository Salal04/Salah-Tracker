ALTER TABLE "users" ADD COLUMN "subscriptionExpiresAt" TIMESTAMP(3);

CREATE TABLE "admin_emails" (
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_emails_pkey" PRIMARY KEY ("email")
);

CREATE TABLE "feature_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" VARCHAR(120) NOT NULL,
    "details" VARCHAR(3000) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "feature_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "feature_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "feature_requests_status_createdAt_idx" ON "feature_requests"("status", "createdAt");
