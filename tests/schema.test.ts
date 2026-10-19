// Verifikasi Prisma client ter-generate sesuai schema v0 (S1-01).
// Import client mengonfirmasi generated code cocok dengan prisma/schema.prisma.
import { describe, it, expect } from "vitest";
import { Prisma, ChannelCode, BookingStatus, CommissionBasis, CollectType } from "@prisma/client";

describe("Prisma schema v0 (S1-01)", () => {
  it("exposes core domain models", () => {
    // Entitas inti (lihat docs/04-data-model.md).
    expect(Prisma.ModelName.Organization).toBe("Organization");
    expect(Prisma.ModelName.User).toBe("User");
    expect(Prisma.ModelName.Property).toBe("Property");
    expect(Prisma.ModelName.Unit).toBe("Unit");
    expect(Prisma.ModelName.Listing).toBe("Listing");
    expect(Prisma.ModelName.Booking).toBe("Booking");
  });

  it("exposes import and payout models", () => {
    expect(Prisma.ModelName.BookingUnit).toBe("BookingUnit");
    expect(Prisma.ModelName.BookingEvent).toBe("BookingEvent");
    expect(Prisma.ModelName.Payout).toBe("Payout");
    expect(Prisma.ModelName.PayoutBooking).toBe("PayoutBooking");
    expect(Prisma.ModelName.ImportBatch).toBe("ImportBatch");
    expect(Prisma.ModelName.ImportItem).toBe("ImportItem");
  });

  it("exposes expense and audit models", () => {
    expect(Prisma.ModelName.ExpenseCategory).toBe("ExpenseCategory");
    expect(Prisma.ModelName.Expense).toBe("Expense");
    expect(Prisma.ModelName.ExpenseAllocation).toBe("ExpenseAllocation");
    expect(Prisma.ModelName.OtherIncome).toBe("OtherIncome");
    expect(Prisma.ModelName.PeriodLock).toBe("PeriodLock");
    expect(Prisma.ModelName.AuditLog).toBe("AuditLog");
  });

  it("exposes ChannelCode enum with expected OTA values", () => {
    // Sumber kebenaran enum: docs/04-data-model.md bagian 3.
    expect(ChannelCode.AIRBNB).toBe("AIRBNB");
    expect(ChannelCode.TIKET_COM).toBe("TIKET_COM");
    expect(ChannelCode.TRAVELOKA).toBe("TRAVELOKA");
    expect(ChannelCode.EXPEDIA).toBe("EXPEDIA");
    expect(ChannelCode.AGODA).toBe("AGODA");
    expect(ChannelCode.DIRECT).toBe("DIRECT");
    expect(ChannelCode.MANUAL).toBe("MANUAL");
  });

  it("exposes BookingStatus enum with expected states", () => {
    expect(BookingStatus.PENDING).toBe("PENDING");
    expect(BookingStatus.CONFIRMED).toBe("CONFIRMED");
    expect(BookingStatus.CANCELLED).toBe("CANCELLED");
    expect(BookingStatus.NO_SHOW).toBe("NO_SHOW");
  });

  it("exposes CommissionBasis with estimated/actual/manual", () => {
    // ADR-004: bedakan estimasi vs aktual.
    expect(CommissionBasis.ESTIMATED).toBe("ESTIMATED");
    expect(CommissionBasis.ACTUAL).toBe("ACTUAL");
    expect(CommissionBasis.MANUAL).toBe("MANUAL");
  });

  it("exposes CollectType with channel/hotel collect", () => {
    // ADR-004: catat model pembayaran per booking.
    expect(CollectType.CHANNEL_COLLECT).toBe("CHANNEL_COLLECT");
    expect(CollectType.HOTEL_COLLECT).toBe("HOTEL_COLLECT");
    expect(CollectType.UNKNOWN).toBe("UNKNOWN");
  });
});
