-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "googleSubject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profilePictureUrl" TEXT,
    "googleDriveAccessTokenEncrypted" TEXT,
    "googleDriveRefreshTokenEncrypted" TEXT,
    "googleDriveTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_googleSubject_key" ON "users"("googleSubject");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
