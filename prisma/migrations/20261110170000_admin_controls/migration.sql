ALTER TABLE "users" ADD COLUMN "suspendedAt" TIMESTAMP(3);

CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminEmail" VARCHAR(254) NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "targetEmail" VARCHAR(254) NOT NULL,
    "details" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_logs_action_createdAt_idx" ON "admin_audit_logs"("action", "createdAt");
CREATE INDEX "admin_audit_logs_targetEmail_createdAt_idx" ON "admin_audit_logs"("targetEmail", "createdAt");
