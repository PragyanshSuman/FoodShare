-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'BUSINESS', 'NGO');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "OrgKind" AS ENUM ('BUSINESS', 'NGO');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ListingMode" AS ENUM ('DONATION', 'SALE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RESERVED', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'REMOVED');

-- CreateEnum
CREATE TYPE "FoodCategory" AS ENUM ('PREPARED_MEAL', 'BAKERY', 'PRODUCE', 'DAIRY', 'PACKAGED', 'BEVERAGES', 'GROCERY', 'MIXED');

-- CreateEnum
CREATE TYPE "DietType" AS ENUM ('VEGETARIAN', 'VEGAN', 'EGGETARIAN', 'NON_VEGETARIAN');

-- CreateEnum
CREATE TYPE "StorageType" AS ENUM ('HOT', 'AMBIENT', 'CHILLED', 'FROZEN');

-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('EVERYONE', 'VERIFIED_NGO_ONLY');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING_PAYMENT', 'PENDING_APPROVAL', 'CONFIRMED', 'IN_DELIVERY', 'COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Fulfilment" AS ENUM ('SELF_PICKUP', 'VOLUNTEER_DELIVERY');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('OPEN', 'ACCEPTED', 'PICKED_UP', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('LISTING', 'USER', 'CLAIM');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('FOOD_SAFETY', 'NO_SHOW', 'MISREPRESENTED', 'HARASSMENT', 'FRAUD', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('LISTING_PURCHASE', 'SUBSCRIPTION', 'SPONSORSHIP', 'PLATFORM_TIP');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'PAID', 'FAILED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "SponsorshipStatus" AS ENUM ('PENDING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "accountType" "AccountType" NOT NULL DEFAULT 'INDIVIDUAL',
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedUntil" TIMESTAMP(3),
    "isVolunteer" BOOLEAN NOT NULL DEFAULT false,
    "city" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "organizationId" TEXT,
    "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "noShowStrikes" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyPush" BOOLEAN NOT NULL DEFAULT true,
    "emailDigest" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "OrgKind" NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "registrationNumber" TEXT,
    "taxExemptId" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "planRenewsAt" TIMESTAMP(3),
    "planReminderSentAt" TIMESTAMP(3),
    "payoutDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "status" "DocStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "locationId" TEXT,
    "scheduleId" TEXT,
    "mode" "ListingMode" NOT NULL DEFAULT 'DONATION',
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "FoodCategory" NOT NULL,
    "dietType" "DietType" NOT NULL,
    "allergens" TEXT[],
    "tags" TEXT[],
    "quantityTotal" INTEGER NOT NULL,
    "quantityAvailable" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "weightKgPerUnit" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "originalPriceCents" INTEGER,
    "currency" TEXT NOT NULL,
    "storage" "StorageType" NOT NULL,
    "preparedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "pickupStart" TIMESTAMP(3) NOT NULL,
    "pickupEnd" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "pickupInstructions" TEXT,
    "photoKeys" TEXT[],
    "audience" "Audience" NOT NULL DEFAULT 'EVERYONE',
    "ngoPriorityUntil" TIMESTAMP(3),
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "allowsDelivery" BOOLEAN NOT NULL DEFAULT true,
    "maxPerClaim" INTEGER,
    "safetyAck" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "expiryWarnedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringSchedule" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "template" JSONB NOT NULL,
    "daysOfWeek" INTEGER[],
    "publishAt" TEXT NOT NULL,
    "pickupStartMin" INTEGER NOT NULL,
    "pickupEndMin" INTEGER NOT NULL,
    "expiresMin" INTEGER NOT NULL,
    "tzOffsetMin" INTEGER NOT NULL DEFAULT 330,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "claimantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ClaimStatus" NOT NULL,
    "fulfilment" "Fulfilment" NOT NULL DEFAULT 'SELF_PICKUP',
    "note" TEXT,
    "pickupCode" TEXT NOT NULL,
    "codeAttempts" INTEGER NOT NULL DEFAULT 0,
    "dropAddress" TEXT,
    "dropLat" DOUBLE PRECISION,
    "dropLng" DOUBLE PRECISION,
    "holdExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "reminderSentAt" TIMESTAMP(3),
    "kgSaved" DOUBLE PRECISION,
    "meals" DOUBLE PRECISION,
    "co2eKg" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryTask" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "volunteerId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'OPEN',
    "pickupLat" DOUBLE PRECISION NOT NULL,
    "pickupLng" DOUBLE PRECISION NOT NULL,
    "dropLat" DOUBLE PRECISION NOT NULL,
    "dropLng" DOUBLE PRECISION NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "dropCode" TEXT NOT NULL,
    "stipendCents" INTEGER,
    "acceptedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "tags" TEXT[],
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolverId" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL,
    "categories" "FoodCategory"[],
    "dietTypes" "DietType"[],
    "modes" "ListingMode"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "OrderKind" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "provider" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
    "tipCents" INTEGER NOT NULL DEFAULT 0,
    "payeeAmountCents" INTEGER NOT NULL DEFAULT 0,
    "claimId" TEXT,
    "organizationId" TEXT,
    "plan" "Plan",
    "periodMonths" INTEGER,
    "sponsorshipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "orderId" TEXT,
    "refId" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsorship" (
    "id" TEXT NOT NULL,
    "sponsorId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "message" TEXT,
    "website" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "deliveriesFunded" INTEGER NOT NULL,
    "status" "SponsorshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sponsorship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeocodeCache" (
    "query" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "displayName" TEXT NOT NULL,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeocodeCache_pkey" PRIMARY KEY ("query")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_isVolunteer_lat_lng_idx" ON "User"("isVolunteer", "lat", "lng");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");

-- CreateIndex
CREATE INDEX "Organization_kind_verificationStatus_idx" ON "Organization"("kind", "verificationStatus");

-- CreateIndex
CREATE INDEX "VerificationDocument_status_idx" ON "VerificationDocument"("status");

-- CreateIndex
CREATE INDEX "Listing_status_lat_lng_idx" ON "Listing"("status", "lat", "lng");

-- CreateIndex
CREATE INDEX "Listing_status_expiresAt_idx" ON "Listing"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Listing_status_pickupEnd_idx" ON "Listing"("status", "pickupEnd");

-- CreateIndex
CREATE INDEX "Listing_ownerId_status_idx" ON "Listing"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Listing_organizationId_status_idx" ON "Listing"("organizationId", "status");

-- CreateIndex
CREATE INDEX "RecurringSchedule_active_nextRunAt_idx" ON "RecurringSchedule"("active", "nextRunAt");

-- CreateIndex
CREATE INDEX "Claim_listingId_status_idx" ON "Claim"("listingId", "status");

-- CreateIndex
CREATE INDEX "Claim_claimantId_status_idx" ON "Claim"("claimantId", "status");

-- CreateIndex
CREATE INDEX "Claim_status_holdExpiresAt_idx" ON "Claim"("status", "holdExpiresAt");

-- CreateIndex
CREATE INDEX "Claim_status_completedAt_idx" ON "Claim"("status", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryTask_claimId_key" ON "DeliveryTask"("claimId");

-- CreateIndex
CREATE INDEX "DeliveryTask_status_pickupLat_pickupLng_idx" ON "DeliveryTask"("status", "pickupLat", "pickupLng");

-- CreateIndex
CREATE INDEX "DeliveryTask_volunteerId_status_idx" ON "DeliveryTask"("volunteerId", "status");

-- CreateIndex
CREATE INDEX "Message_claimId_createdAt_idx" ON "Message"("claimId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_subjectId_idx" ON "Review"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_claimId_authorId_key" ON "Review"("claimId", "authorId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "AlertPreference_active_lat_lng_idx" ON "AlertPreference"("active", "lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "Order_providerOrderId_key" ON "Order"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_claimId_key" ON "Order"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_sponsorshipId_key" ON "Order"("sponsorshipId");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_account_createdAt_idx" ON "LedgerEntry"("account", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_status_createdAt_idx" ON "Payout"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_userId_idx" ON "Payout"("userId");

-- CreateIndex
CREATE INDEX "Sponsorship_status_createdAt_idx" ON "Sponsorship"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RecurringSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSchedule" ADD CONSTRAINT "RecurringSchedule_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_claimantId_fkey" FOREIGN KEY ("claimantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTask" ADD CONSTRAINT "DeliveryTask_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryTask" ADD CONSTRAINT "DeliveryTask_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertPreference" ADD CONSTRAINT "AlertPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sponsorshipId_fkey" FOREIGN KEY ("sponsorshipId") REFERENCES "Sponsorship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sponsorship" ADD CONSTRAINT "Sponsorship_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

