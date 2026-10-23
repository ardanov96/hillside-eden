import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AirbnbEmailAdapter } from "@/adapters/airbnb/email/adapter";
import type { RawInput } from "@/adapters/types";

describe("Airbnb Email Adapter (S5-03)", () => {
  const adapter = new AirbnbEmailAdapter();

  const loadFixture = (name: string) => {
    const p = join(process.cwd(), `fixtures/synthetic/airbnb/email/${name}.json`);
    return JSON.parse(readFileSync(p, "utf-8"));
  };

  const confirmedFixture = loadFixture("confirmed-synthetic");
  const alteredFixture = loadFixture("altered-synthetic");
  const cancelledFixture = loadFixture("cancelled-synthetic");

  it("mengenali email dari airbnb.com via supports()", () => {
    const input: RawInput = {
      kind: "email",
      receivedAt: new Date(),
      from: "automated@airbnb.com",
      subject: "Reservation confirmed",
    };
    expect(adapter.supports(input)).toBe(true);

    const nonAirbnb: RawInput = {
      kind: "email",
      receivedAt: new Date(),
      from: "promo@newsletter.com",
      subject: "Discount",
    };
    expect(adapter.supports(nonAirbnb)).toBe(false);
  });

  it("mem-parse email reservasi baru (confirmed) -> CREATED", async () => {
    const input: RawInput = {
      kind: "email",
      receivedAt: new Date(),
      from: confirmedFixture.from,
      subject: confirmedFixture.subject,
      text: confirmedFixture.text,
    };

    const res = await adapter.parse(input);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.events).toHaveLength(1);
    const ev = res.events![0]!;
    expect(ev.eventType).toBe("CREATED");
    expect(ev.booking.status).toBe("CONFIRMED");
    expect(ev.booking.externalId).toBe("HM12345678");
    expect(ev.booking.checkIn).toBe("2026-11-01");
    expect(ev.booking.checkOut).toBe("2026-11-05");
    expect(ev.booking.nights).toBe(4);
    expect(ev.booking.guestName).toBe("John D.");
    expect(ev.booking.grossAmount).toBe("8500000.00");
  });

  it("mem-parse email modifikasi reservasi (altered) -> MODIFIED", async () => {
    const input: RawInput = {
      kind: "email",
      receivedAt: new Date(),
      from: alteredFixture.from,
      subject: alteredFixture.subject,
      text: alteredFixture.text,
    };

    const res = await adapter.parse(input);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.events).toHaveLength(1);
    const ev = res.events![0]!;
    expect(ev.eventType).toBe("MODIFIED");
    expect(ev.booking.status).toBe("CONFIRMED");
    expect(ev.booking.externalId).toBe("HM12345678");
    expect(ev.booking.checkIn).toBe("2026-11-02");
    expect(ev.booking.checkOut).toBe("2026-11-06");
  });

  it("mem-parse email pembatalan reservasi (cancelled) -> CANCELLED", async () => {
    const input: RawInput = {
      kind: "email",
      receivedAt: new Date(),
      from: cancelledFixture.from,
      subject: cancelledFixture.subject,
      text: cancelledFixture.text,
    };

    const res = await adapter.parse(input);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.events).toHaveLength(1);
    const ev = res.events![0]!;
    expect(ev.eventType).toBe("CANCELLED");
    expect(ev.booking.status).toBe("CANCELLED");
    expect(ev.booking.externalId).toBe("HM12345678");
  });

  it("mengembalikan error jika email tidak memiliki kode konfirmasi yang valid", async () => {
    const input: RawInput = {
      kind: "email",
      receivedAt: new Date(),
      from: "automated@airbnb.com",
      subject: "Welcome to Airbnb",
      text: "No booking code here",
    };

    const res = await adapter.parse(input);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errorCode).toBe("INVALID_VALUE");
    }
  });
});
