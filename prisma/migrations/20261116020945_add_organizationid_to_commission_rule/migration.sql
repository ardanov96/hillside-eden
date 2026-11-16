/*
  Warnings:

  - Added the required column `organizationId` to the `CommissionRule` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CommissionRule_channel_validFrom_idx";

-- AlterTable
ALTER TABLE "CommissionRule" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "CommissionRule_organizationId_channel_validFrom_idx" ON "CommissionRule"("organizationId", "channel", "validFrom");

-- CreateIndex
CREATE INDEX "CommissionRule_organizationId_channel_listingId_idx" ON "CommissionRule"("organizationId", "channel", "listingId");

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "booking_event_unique_per_type_time" RENAME TO "BookingEvent_bookingId_type_occurredAt_key";
