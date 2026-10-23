import { describe, it, expect } from "vitest";
import {
  parseIcal,
  unfoldIcalLines,
  parseIcalDateString,
  isPrivateIPv4,
  isPrivateIPv6,
  validateSsrfSafeUrl,
  SsrfBlockedError,
} from "@/adapters/ical";

describe("iCal SSRF Protection (S5-04)", () => {
  it("mendeteksi rentang IP privat dan reserved IPv4", () => {
    expect(isPrivateIPv4("127.0.0.1")).toBe(true);
    expect(isPrivateIPv4("10.0.0.5")).toBe(true);
    expect(isPrivateIPv4("172.16.0.1")).toBe(true);
    expect(isPrivateIPv4("172.31.255.255")).toBe(true);
    expect(isPrivateIPv4("192.168.1.100")).toBe(true);
    expect(isPrivateIPv4("169.254.169.254")).toBe(true); // AWS/cloud metadata
    expect(isPrivateIPv4("0.0.0.0")).toBe(true);

    // IP publik yang valid
    expect(isPrivateIPv4("8.8.8.8")).toBe(false);
    expect(isPrivateIPv4("1.1.1.1")).toBe(false);
    expect(isPrivateIPv4("104.18.25.10")).toBe(false);
  });

  it("mendeteksi rentang IP privat IPv6", () => {
    expect(isPrivateIPv6("::1")).toBe(true);
    expect(isPrivateIPv6("::")).toBe(true);
    expect(isPrivateIPv6("fe80::1")).toBe(true);
    expect(isPrivateIPv6("fc00::1")).toBe(true);
    expect(isPrivateIPv6("fd12:3456:789a:1::1")).toBe(true);

    // IPv6 publik Google/Cloudflare
    expect(isPrivateIPv6("2001:4860:4860::8888")).toBe(false);
    expect(isPrivateIPv6("2606:4700:4700::1111")).toBe(false);
  });

  it("memblokir URL dengan IP lokal atau cloud metadata", async () => {
    await expect(validateSsrfSafeUrl("http://127.0.0.1/calendar.ics")).rejects.toThrow(
      SsrfBlockedError,
    );
    await expect(validateSsrfSafeUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(
      SsrfBlockedError,
    );
    await expect(validateSsrfSafeUrl("http://192.168.1.1/feed.ics")).rejects.toThrow(
      SsrfBlockedError,
    );
    await expect(validateSsrfSafeUrl("http://10.200.0.1/feed.ics")).rejects.toThrow(
      SsrfBlockedError,
    );
    await expect(validateSsrfSafeUrl("http://localhost:5432/feed.ics")).rejects.toThrow(
      SsrfBlockedError,
    );
  });

  it("memblokir skema URL selain http/https", async () => {
    await expect(validateSsrfSafeUrl("ftp://example.com/calendar.ics")).rejects.toThrow(
      SsrfBlockedError,
    );
    await expect(validateSsrfSafeUrl("file:///etc/passwd")).rejects.toThrow(SsrfBlockedError);
    await expect(validateSsrfSafeUrl("gopher://127.0.0.1:70/")).rejects.toThrow(SsrfBlockedError);
  });

  it("menerima URL publik dengan protokol https", async () => {
    const res = await validateSsrfSafeUrl("https://1.1.1.1/calendar.ics");
    expect(res.validUrl.protocol).toBe("https:");
    expect(res.resolvedIp).toBe("1.1.1.1");
  });
});

describe("iCal RFC 5545 Parser (S5-04)", () => {
  it("membuka lipatan baris (line unfolding)", () => {
    const raw = "SUMMARY:Reservasi Villa\n  Hillside Eden Ubud\n  Payangan\nDESCRIPTION:Lengkap";
    const unfolded = unfoldIcalLines(raw);
    expect(unfolded).toEqual([
      "SUMMARY:Reservasi Villa Hillside Eden Ubud Payangan",
      "DESCRIPTION:Lengkap",
    ]);
  });

  it("mem-parse format tanggal iCal YYYYMMDD", () => {
    expect(parseIcalDateString("20261025")).toBe("2026-10-25");
    expect(parseIcalDateString("VALUE=DATE:20261025")).toBe("2026-10-25");
    expect(parseIcalDateString("TZID=Asia/Makassar:20261025T140000")).toBe("2026-10-25");
    expect(parseIcalDateString("20261399")).toBeNull(); // Tanggal tidak valid
  });

  it("mem-parse feed iCal Airbnb sintetis lengkap", () => {
    const icalSample = `BEGIN:VCALENDAR
PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Ubud Hillside
BEGIN:VEVENT
DTSTAMP:20261023T030000Z
DTSTART;VALUE=DATE:20261101
DTEND;VALUE=DATE:20261105
UID:airbnb-res-101@airbnb.com
SUMMARY:Airbnb (Not available)
DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HM123456
END:VEVENT
BEGIN:VEVENT
DTSTAMP:20261023T030000Z
DTSTART;VALUE=DATE:20261110
DTEND;VALUE=DATE:20261115
UID:airbnb-res-102@airbnb.com
SUMMARY:Reserved
END:VEVENT
END:VCALENDAR`;

    const res = parseIcal(icalSample);
    expect(res.ok).toBe(true);
    expect(res.events).toHaveLength(2);

    expect(res.events[0]).toEqual({
      uid: "airbnb-res-101@airbnb.com",
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      summary: "Airbnb (Not available)",
      description: "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HM123456",
    });

    expect(res.events[1]).toEqual({
      uid: "airbnb-res-102@airbnb.com",
      startDate: "2026-11-10",
      endDate: "2026-11-15",
      summary: "Reserved",
      description: undefined,
    });
  });

  it("menangani VEVENT tanpa DTEND dengan menetapkan tanggal berikutnya (DTSTART + 1 hari)", () => {
    const singleDayIcal = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261225
UID:single-day-block@airbnb.com
SUMMARY:Blocked Day
END:VEVENT
END:VCALENDAR`;

    const res = parseIcal(singleDayIcal);
    expect(res.ok).toBe(true);
    expect(res.events).toHaveLength(1);
    expect(res.events[0]!.startDate).toBe("2026-12-25");
    expect(res.events[0]!.endDate).toBe("2026-12-26");
  });

  it("mencatat error pada VEVENT tanpa UID", () => {
    const invalidIcal = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261225
SUMMARY:No UID
END:VEVENT
END:VCALENDAR`;

    const res = parseIcal(invalidIcal);
    expect(res.ok).toBe(false);
    expect(res.events).toHaveLength(0);
    expect(res.errors[0]).toContain("UID tidak ditemukan");
  });
});
