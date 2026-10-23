/**
 * Unit test untuk pipeline penautan payout (S7-02).
 */
import { describe, expect, it, vi } from "vitest";
import { Decimal } from "@/lib/decimal";
import { linkPayouts } from "@/ingest/pipeline/payout";
import type { ParsedPayout } from "@/adapters/types";

describe("linkPayouts", () => {
  it("membuat Payout, menautkan ke Booking, memperbarui ACTUAL commission dan mencatat event", async () => {
    const mockBooking = {
      id: "booking-1",
      organizationId: "org-1",
      channel: "AIRBNB",
      externalId: "HM12345",
      grossAmount: new Decimal("2000000"),
      commissionAmount: new Decimal("300000"),
      commissionBasis: "ESTIMATED",
      collectType: "UNKNOWN",
    };

    const mockPayout = {
      id: "payout-1",
      organizationId: "org-1",
      channel: "AIRBNB",
      reference: "PAY-001",
      amount: new Decimal("1700000"),
      currency: "IDR",
    };

    const createdEvents: unknown[] = [];
    const createdLinks: unknown[] = [];
    let updatedBookingData: unknown = null;

    const mockPrisma = {
      payout: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(mockPayout),
      },
      booking: {
        findUnique: vi.fn().mockResolvedValue(mockBooking),
        update: vi.fn().mockImplementation((args: { data: unknown }) => {
          updatedBookingData = args.data;
          return Promise.resolve({
            ...mockBooking,
            ...(args.data as Record<string, unknown>),
          });
        }),
      },
      payoutBooking: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args: { data: unknown }) => {
          createdLinks.push(args.data);
          return Promise.resolve(args.data);
        }),
      },
      bookingEvent: {
        create: vi.fn().mockImplementation((args: { data: unknown }) => {
          createdEvents.push(args.data);
          return Promise.resolve(args.data);
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
    } as unknown as import("@prisma/client").PrismaClient;

    const parsedPayouts: ParsedPayout[] = [
      {
        channel: "AIRBNB",
        reference: "PAY-001",
        payoutDate: "2026-10-25",
        amount: "1700000",
        currency: "IDR",
        bookingExternalIds: ["HM12345"],
      },
    ];

    const result = await linkPayouts(mockPrisma, {
      organizationId: "org-1",
      payouts: parsedPayouts,
    });

    expect(result.totalPayouts).toBe(1);
    expect(result.createdPayouts).toBe(1);
    expect(result.linkedBookings).toBe(1);
    expect(result.unmatchedBookings).toBe(0);

    // Komisi aktual = 2.000.000 - 1.700.000 = 300.000
    expect(updatedBookingData).toMatchObject({
      commissionBasis: "ACTUAL",
      collectType: "CHANNEL_COLLECT",
    });
    expect((updatedBookingData as { commissionAmount: Decimal }).commissionAmount.toString()).toBe(
      "300000",
    );

    // PayoutBooking dibuat
    expect(createdLinks).toHaveLength(1);
    expect(createdLinks[0]).toMatchObject({
      payoutId: "payout-1",
      bookingId: "booking-1",
    });

    // BookingEvent PAYOUT_LINKED dicatat
    expect(createdEvents).toHaveLength(1);
    expect(createdEvents[0]).toMatchObject({
      bookingId: "booking-1",
      type: "PAYOUT_LINKED",
    });
  });

  it("mencatat warning bila bookingExternalId tidak ditemukan tanpa menggagalkan payout lain", async () => {
    const mockPrisma = {
      payout: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "payout-2",
          amount: new Decimal("500000"),
          currency: "IDR",
          channel: "AIRBNB",
        }),
      },
      booking: {
        findUnique: vi.fn().mockResolvedValue(null), // Booking tidak ditemukan
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
    } as unknown as import("@prisma/client").PrismaClient;

    const result = await linkPayouts(mockPrisma, {
      organizationId: "org-1",
      payouts: [
        {
          channel: "AIRBNB",
          reference: "PAY-UNMATCHED",
          payoutDate: "2026-10-25",
          amount: "500000",
          currency: "IDR",
          bookingExternalIds: ["UNKNOWN_CODE"],
        },
      ],
    });

    expect(result.totalPayouts).toBe(1);
    expect(result.createdPayouts).toBe(1);
    expect(result.linkedBookings).toBe(0);
    expect(result.unmatchedBookings).toBe(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("UNKNOWN_CODE");
  });
});
