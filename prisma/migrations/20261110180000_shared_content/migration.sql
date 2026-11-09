CREATE TABLE "content_settings" (
    "id" TEXT NOT NULL,
    "quoteMode" VARCHAR(20) NOT NULL DEFAULT 'rotating',
    "fixedQuoteId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "content_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily_quotes" (
    "id" TEXT NOT NULL,
    "text" VARCHAR(600) NOT NULL,
    "attribution" VARCHAR(160),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "daily_quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shared_resources" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "description" VARCHAR(600),
    "url" VARCHAR(2048) NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shared_resources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(3000) NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "daily_quotes_active_createdAt_idx" ON "daily_quotes"("active", "createdAt");
CREATE INDEX "shared_resources_published_createdAt_idx" ON "shared_resources"("published", "createdAt");
CREATE INDEX "announcements_published_updatedAt_idx" ON "announcements"("published", "updatedAt");
