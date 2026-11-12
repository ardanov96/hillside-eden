import { describe, it, expect } from "vitest";
import { DirectWebhookAdapter, DIRECT_WEBHOOK_ADAPTER_ID } from "@/adapters/direct/adapter";
import { parseDirectWebhookPayload, normalizeDirectBookingStatus } from "@/adapters/direct/parser";
import type { RawInput } from "@/adapters/types";

describe("DirectWebhookAdapter & Parser (Opsi A - Direct Booking hillsideedenubud.com)", () => {
  const adapter = new DirectWebhookAdapter();

  describe("Adapter Contract & Identification", () => {
    it("memiliki id dan channel yang benar", () => {
      expect(adapter.id).toBe(DIRECT_WEBHOOK_ADAPTER_ID);
      expect(adapter.channel).toBe("DIRECT");
    });

    it("supports() mengidentifikasi RawInput kind: 'webhook' dengan channel: 'DIRECT'", () => {
      const validWebhook: RawInput = {
        kind: "webhook",
        channel: "DIRECT",
        source: "direct-website",
        payload: { bookingId: "HE-101" },
      };
      expect(adapter.supports(validWebhook)).toBe(true);

      const invalidChannel: RawInput = {
        kind: "webhook",
        channel: "AIRBNB",
        payload: {},
      };
      expect(adapter.supports(invalidChannel)).toBe(false);

      const csvInput: RawInput = {
        kind: "csv",
        filename: "test.csv",
        content: "a,b,c",
      };
      expect(adapter.supports(csvInput)).toBe(false);
    });
  });

  describe("Status Normalization", () => {
    it("menormalkan status confirmed, completed, paid ke CONFIRMED", () => {
      expect(normalizeDirectBookingStatus("confirmed")).toBe("CONFIRMED");
      expect(normalizeDirectBookingStatus("completed")).toBe("CONFIRMED");
      expect(normalizeDirectBookingStatus("paid")).toBe("CONFIRMED");
      expect(normalizeDirectBookingStatus("publish")).toBe("CONFIRMED");
    });

    it("menormalkan status pending, on-hold, processing ke PENDING", () => {
      expect(normalizeDirectBookingStatus("pending")).toBe("PENDING");
      expect(normalizeDirectBookingStatus("on-hold")).toBe("PENDING");
      expect(normalizeDirectBookingStatus("processing")).toBe("PENDING");
    });

    it("menormalkan status cancelled, refunded, failed ke CANCELLED", () => {
      expect(normalizeDirectBookingStatus("cancelled")).toBe("CANCELLED");
      expect(normalizeDirectBookingStatus("refunded")).toBe("CANCELLED");
      expect(normalizeDirectBookingStatus("failed")).toBe("CANCELLED");
    });

    it("menormalkan status no_show ke NO_SHOW", () => {
      expect(normalizeDirectBookingStatus("no_show")).toBe("NO_SHOW");
      expect(normalizeDirectBookingStatus("no-show")).toBe("NO_SHOW");
    });
  });

  describe("Standard Direct Booking JSON Payload", () => {
    it("berhasil mem-parsing payload format standar dengan data lengkap", () => {
      const payload = {
        bookingId: "HE-2026-001",
        status: "CONFIRMED",
        guestName: "Sarah Jenkins",
        guestEmail: "sarah@example.com",
        checkIn: "2026-12-10",
        checkOut: "2026-12-15",
        guestsCount: 4,
        currency: "IDR",
        grossAmount: "25000000",
        collectType: "CHANNEL_COLLECT",
        bookedAt: "2026-11-10T14:30:00Z",
      };

      const result = parseDirectWebhookPayload(payload);
      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.events).toHaveLength(1);
        const event = result.events[0]!;
        expect(event.eventType).toBe("CREATED");
        expect(event.confidence).toBe("high");

        const booking = event.booking;
        expect(booking.channel).toBe("DIRECT");
        expect(booking.externalId).toBe("HE-2026-001");
        expect(booking.status).toBe("CONFIRMED");
        expect(booking.checkIn).toBe("2026-12-10");
        expect(booking.checkOut).toBe("2026-12-15");
        expect(booking.nights).toBe(5);
        expect(booking.guestName).toBe("Sarah Jenkins");
        expect(booking.grossAmount).toBe("25000000.00");
        expect(booking.commissionAmount).toBe("0.00"); // Bebas komisi OTA
        expect(booking.commissionRate).toBe("0");
        expect(booking.collectType).toBe("CHANNEL_COLLECT");
        expect(booking.externalListingId).toBe("he-direct-website");
      }
    });

    it("menangani event CANCELLED dengan cancellation fee", () => {
      const payload = {
        bookingId: "HE-2026-002",
        status: "CANCELLED",
        checkIn: "2026-12-20",
        checkOut: "2026-12-23",
        cancellationFee: "5000000",
        currency: "IDR",
      };

      const result = parseDirectWebhookPayload(payload);
      expect(result.ok).toBe(true);

      if (result.ok) {
        const event = result.events[0]!;
        expect(event.eventType).toBe("CANCELLED");
        expect(event.booking.status).toBe("CANCELLED");
        expect(event.booking.cancellationFee).toBe("5000000.00");
      }
    });
  });

  describe("WordPress MotoPress Hotel Booking (mphb) Payload", () => {
    it("berhasil mem-parsing payload bawaan MotoPress Hotel Booking", () => {
      const mphbPayload = {
        id: 1042,
        status: "confirmed",
        check_in_date: "2026-12-05",
        check_out_date: "2026-12-08",
        total_price: "18.500.000",
        currency: "IDR",
        customer: {
          first_name: "Budi",
          last_name: "Santoso",
          email: "budi.santoso@example.com",
          phone: "+628123456789",
        },
        adults: 2,
        payment_method: "midtrans",
      };

      const result = parseDirectWebhookPayload(mphbPayload);
      expect(result.ok).toBe(true);

      if (result.ok) {
        const booking = result.events[0]!.booking;
        expect(booking.externalId).toBe("1042");
        expect(booking.status).toBe("CONFIRMED");
        expect(booking.checkIn).toBe("2026-12-05");
        expect(booking.checkOut).toBe("2026-12-08");
        expect(booking.nights).toBe(3);
        expect(booking.guestName).toBe("Budi Santoso");
        expect(booking.grossAmount).toBe("18500000.00");
        expect(booking.commissionAmount).toBe("0.00");
      }
    });
  });

  describe("WooCommerce Order Webhook Payload", () => {
    it("berhasil mem-parsing payload pesanan WooCommerce", () => {
      const wcPayload = {
        id: 2541,
        status: "completed",
        currency: "IDR",
        total: "15000000.00",
        billing: {
          first_name: "Michael",
          last_name: "Brown",
          email: "michael@example.com",
        },
        meta_data: [
          { key: "mphb_check_in_date", value: "2026-12-15" },
          { key: "mphb_check_out_date", value: "2026-12-18" },
        ],
        payment_method: "bacs", // Bank transfer -> HOTEL_COLLECT / direct
      };

      const result = parseDirectWebhookPayload(wcPayload);
      expect(result.ok).toBe(true);

      if (result.ok) {
        const booking = result.events[0]!.booking;
        expect(booking.externalId).toBe("2541");
        expect(booking.status).toBe("CONFIRMED");
        expect(booking.checkIn).toBe("2026-12-15");
        expect(booking.checkOut).toBe("2026-12-18");
        expect(booking.nights).toBe(3);
        expect(booking.guestName).toBe("Michael Brown");
        expect(booking.grossAmount).toBe("15000000.00");
      }
    });
  });

  describe("Validation & Error Cases", () => {
    it("menolak payload tanpa externalId", () => {
      const invalid = {
        checkIn: "2026-12-01",
        checkOut: "2026-12-03",
        grossAmount: "1000000",
      };
      const result = parseDirectWebhookPayload(invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errorCode).toBe("MISSING_FIELD");
      }
    });

    it("menolak payload bila checkOut <= checkIn", () => {
      const invalid = {
        bookingId: "HE-ERR-1",
        checkIn: "2026-12-05",
        checkOut: "2026-12-03",
        grossAmount: "1000000",
      };
      const result = parseDirectWebhookPayload(invalid);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errorCode).toBe("INVALID_VALUE");
      }
    });

    it("menolak booking CONFIRMED tanpa grossAmount valid", () => {
      const invalid = {
        bookingId: "HE-ERR-2",
        status: "CONFIRMED",
        checkIn: "2026-12-01",
        checkOut: "2026-12-03",
        grossAmount: "",
      };
      const result = parseDirectWebhookPayload(invalid);
      expect(result.ok).toBe(false);
    });
  });
});
