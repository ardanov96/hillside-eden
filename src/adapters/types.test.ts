import { describe, it, expect } from "vitest";
import {
  safeValidateNormalizedBooking,
  validateNormalizedBooking,
  validateParsedBookingEvent,
  validateParsedPayout,
} from "./schema";
import type {
  NormalizedBooking,
  ParsedBookingEvent,
  ParsedPayout,
  RawInput,
  SourceAdapter,
} from "./types";

describe("adapters/types & schema (S2-01: Kontrak Adapter & NormalizedBooking)", () => {
  const validBooking: NormalizedBooking = {
    channel: "AIRBNB",
    externalId: "HM12345678",
    externalListingId: "1009025545235278907",
    listingName: "Ubud Hillside Villa",
    status: "CONFIRMED",
    bookedAt: new Date("2026-10-15T08:00:00Z"),
    checkIn: "2026-10-20",
    checkOut: "2026-10-23",
    nights: 3,
    guestsCount: 2,
    guestName: "John D.",
    countryCode: "US",
    currency: "IDR",
    grossAmount: "3000000",
    commissionAmount: "450000",
    commissionRate: "0.15",
    collectType: "CHANNEL_COLLECT",
  };

  it("memvalidasi NormalizedBooking valid tanpa error", () => {
    const validated = validateNormalizedBooking(validBooking);
    expect(validated.channel).toBe("AIRBNB");
    expect(validated.externalId).toBe("HM12345678");
    expect(validated.status).toBe("CONFIRMED");
    expect(validated.checkIn).toBe("2026-10-20");
    expect(validated.checkOut).toBe("2026-10-23");
  });

  it("menolak checkOut yang mendahului atau sama dengan checkIn", () => {
    const invalidDates = {
      ...validBooking,
      checkIn: "2026-10-25",
      checkOut: "2026-10-20",
    };
    const result = safeValidateNormalizedBooking(invalidDates);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/checkOut .* harus lebih besar dari checkIn/);
    }
  });

  it("menolak booking CONFIRMED tanpa grossAmount", () => {
    const missingGross = {
      ...validBooking,
      grossAmount: undefined,
    };
    const result = safeValidateNormalizedBooking(missingGross);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(
        /grossAmount wajib ada untuk booking berstatus CONFIRMED/,
      );
    }
  });

  it("mengizinkan booking CANCELLED tanpa grossAmount tetapi dengan cancellationFee", () => {
    const cancelled: NormalizedBooking = {
      channel: "TIKET_COM",
      externalId: "TC-9988",
      status: "CANCELLED",
      checkIn: "2026-11-01",
      checkOut: "2026-11-05",
      currency: "IDR",
      cancellationFee: "500000",
    };
    const validated = validateNormalizedBooking(cancelled);
    expect(validated.status).toBe("CANCELLED");
    expect(validated.cancellationFee).toBe("500000");
  });

  it("menolak format tanggal yang tidak valid", () => {
    const invalidDateFormat = {
      ...validBooking,
      checkIn: "20-10-2026", // bukan YYYY-MM-DD
    };
    const result = safeValidateNormalizedBooking(invalidDateFormat);
    expect(result.success).toBe(false);
  });

  it("menolak channel code di luar enum yang didukung", () => {
    const invalidChannel = {
      ...validBooking,
      channel: "UNKNOWN_OTA",
    };
    const result = safeValidateNormalizedBooking(invalidChannel);
    expect(result.success).toBe(false);
  });

  it("memvalidasi ParsedBookingEvent lengkap", () => {
    const event: ParsedBookingEvent = {
      eventType: "CREATED",
      occurredAt: new Date("2026-10-15T08:00:00Z"),
      booking: validBooking,
      confidence: "high",
      warnings: [],
    };
    const validated = validateParsedBookingEvent(event);
    expect(validated.eventType).toBe("CREATED");
    expect(validated.confidence).toBe("high");
  });

  it("memvalidasi ParsedPayout", () => {
    const payout: ParsedPayout = {
      channel: "AIRBNB",
      reference: "PO-778899",
      payoutDate: "2026-10-24",
      amount: "2550000",
      currency: "IDR",
      bookingExternalIds: ["HM12345678"],
    };
    const validated = validateParsedPayout(payout);
    expect(validated.reference).toBe("PO-778899");
    expect(validated.amount).toBe("2550000");
  });

  it("SourceAdapter interface dapat diimplementasikan oleh adapter dummy", async () => {
    class DummyAirbnbEmailAdapter implements SourceAdapter {
      readonly id = "airbnb.email.v1";
      readonly channel = "AIRBNB" as const;

      supports(input: RawInput): boolean {
        return (
          input.kind === "email" &&
          (input.from.includes("airbnb.com") || input.subject.includes("Airbnb"))
        );
      }

      parse(input: RawInput) {
        if (!this.supports(input)) {
          return {
            ok: false as const,
            errorCode: "UNSUPPORTED_FORMAT" as const,
            message: "Not an Airbnb email",
          };
        }
        return {
          ok: true as const,
          events: [
            {
              eventType: "CREATED" as const,
              occurredAt: new Date("2026-10-15T08:00:00Z"),
              booking: validBooking,
              confidence: "high" as const,
              warnings: [],
            },
          ],
        };
      }
    }

    const adapter = new DummyAirbnbEmailAdapter();
    const emailInput: RawInput = {
      kind: "email",
      receivedAt: new Date(),
      from: "automated@airbnb.com",
      subject: "Reservation confirmed - HM12345678",
      headers: {},
      storageKey: "raw/airbnb/1.eml",
    };

    expect(adapter.supports(emailInput)).toBe(true);
    const result = await adapter.parse(emailInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.events[0]?.booking.externalId).toBe("HM12345678");
    }

    const csvInput: RawInput = {
      kind: "csv",
      filename: "test.csv",
      content: Buffer.from("test"),
    };
    expect(adapter.supports(csvInput)).toBe(false);
  });
});
