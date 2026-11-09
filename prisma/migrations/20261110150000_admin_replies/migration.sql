ALTER TABLE "feature_requests"
ADD COLUMN "adminReply" VARCHAR(3000),
ADD COLUMN "repliedBy" VARCHAR(254),
ADD COLUMN "repliedAt" TIMESTAMP(3);
