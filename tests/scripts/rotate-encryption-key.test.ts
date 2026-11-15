/**
 * Unit test skrip rotasi kunci enkripsi (scripts/rotate-encryption-key.ts).
 *
 * Yang diuji: perencanaan rotasi murni (tanpa DB) — verifikasi dekripsi
 * dengan kunci lama, enkripsi ulang dengan kunci baru, penanganan URL legacy
 * plaintext, serta pembatalan bila ada baris yang gagal didekripsi.
 */
import { describe, expect, it } from "vitest";
import { decryptTextWithKey, deriveEncryptionKey, encryptTextWithKey } from "@/lib/crypto";
import { looksLikeCipher, planRotation } from "../../scripts/rotate-encryption-key";

const OLD_SECRET = "kunci-lama-untuk-uji-minimal-32-karakter";
const NEW_SECRET = "kunci-baru-untuk-uji-minimal-32-karakter";

const OLD_KEY = deriveEncryptionKey(OLD_SECRET);
const NEW_KEY = deriveEncryptionKey(NEW_SECRET);

const URL_ICAL = "https://www.airbnb.com/calendar/ical/12345.ics?s=rahasia";

describe("rotasi kunci enkripsi iCal", () => {
  it("mengenali format ciphertext", () => {
    expect(looksLikeCipher(encryptTextWithKey(URL_ICAL, OLD_KEY))).toBe(true);
    expect(looksLikeCipher(URL_ICAL)).toBe(false);
    expect(looksLikeCipher("a:b")).toBe(false);
    expect(looksLikeCipher("zz:zz:zz")).toBe(false);
  });

  it("mengenkripsi ulang ciphertext lama dengan kunci baru", () => {
    const encryptedOld = encryptTextWithKey(URL_ICAL, OLD_KEY);
    const { planned, failures } = planRotation(
      [{ id: "feed-1", listingId: "listing-1", urlEncrypted: encryptedOld }],
      OLD_KEY,
      NEW_KEY,
    );

    expect(failures).toEqual([]);
    expect(planned).toHaveLength(1);
    expect(planned[0]?.kind).toBe("cipher");
    expect(planned[0]?.newValue).not.toBe(encryptedOld);

    // Bisa didekripsi dengan kunci baru, tidak lagi dengan kunci lama.
    expect(decryptTextWithKey(planned[0]!.newValue, NEW_KEY)).toBe(URL_ICAL);
    expect(() => decryptTextWithKey(planned[0]!.newValue, OLD_KEY)).toThrow();
  });

  it("mengenkripsi URL legacy yang tersimpan plaintext", () => {
    const { planned, failures } = planRotation(
      [{ id: "feed-2", listingId: "listing-2", urlEncrypted: URL_ICAL }],
      OLD_KEY,
      NEW_KEY,
    );

    expect(failures).toEqual([]);
    expect(planned[0]?.kind).toBe("legacy-plaintext");
    expect(decryptTextWithKey(planned[0]!.newValue, NEW_KEY)).toBe(URL_ICAL);
  });

  it("membatalkan rotasi bila ada baris yang gagal didekripsi (kunci lama salah)", () => {
    const encryptedOther = encryptTextWithKey(
      URL_ICAL,
      deriveEncryptionKey("kunci-lain".padEnd(32, "z")),
    );
    const { planned, failures } = planRotation(
      [{ id: "feed-3", listingId: "listing-3", urlEncrypted: encryptedOther }],
      OLD_KEY,
      NEW_KEY,
    );

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("feed-3");
    expect(planned).toHaveLength(0);
  });

  it("membiarkan nilai kosong apa adanya", () => {
    const { planned, failures } = planRotation(
      [{ id: "feed-4", listingId: "listing-4", urlEncrypted: "" }],
      OLD_KEY,
      NEW_KEY,
    );

    expect(failures).toEqual([]);
    expect(planned[0]?.kind).toBe("empty");
    expect(planned[0]?.newValue).toBe("");
  });
});
