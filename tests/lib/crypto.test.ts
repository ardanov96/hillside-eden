/**
 * Unit test untuk modul enkripsi simetris dan masking URL iCal (S9-02).
 */
import { describe, expect, it } from "vitest";
import { encryptText, decryptText, maskIcalUrl } from "@/lib/crypto";

describe("crypto utility (S9-02)", () => {
  it("dapat mengenkripsi dan mendekripsi string dengan benar (round-trip)", () => {
    const original = "https://www.airbnb.com/calendar/ical/12345.ics?s=abcdef123456";
    const encrypted = encryptText(original);

    expect(encrypted).not.toBe(original);
    expect(encrypted.split(":")).toHaveLength(3); // iv:authTag:cipher

    const decrypted = decryptText(encrypted);
    expect(decrypted).toBe(original);
  });

  it("menangani string kosong secara aman", () => {
    expect(encryptText("")).toBe("");
    expect(decryptText("")).toBe("");
  });

  it("mengembalikan teks apa adanya jika format bukan cipher valid", () => {
    const plainUrl = "https://example.com/calendar.ics";
    expect(decryptText(plainUrl)).toBe(plainUrl);
  });

  it("menyamarkan parameter query rahasia pada maskIcalUrl", () => {
    const secretUrl = "https://www.airbnb.com/calendar/ical/999.ics?s=supersecretkey&token=123";
    const masked = maskIcalUrl(secretUrl);

    expect(masked).toContain("https://www.airbnb.com/calendar/ical/999.ics");
    expect(masked).not.toContain("supersecretkey");
    expect(masked).not.toContain("123");
    expect(masked).toContain("s=***");
    expect(masked).toContain("token=***");
  });

  it("menangani URL tanpa parameter query dengan aman", () => {
    const url = "https://example.com/feed.ics";
    expect(maskIcalUrl(url)).toBe(url);
  });
});
