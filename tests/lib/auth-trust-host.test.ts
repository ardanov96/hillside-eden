/**
 * Unit test kebijakan `trustHost` Auth.js v5 (ADR-032).
 *
 * Fokus: helper murni `src/lib/auth-trust-host.ts` — tidak menyentuh env
 * global maupun jaringan, sehingga deterministik.
 */
import { describe, expect, it } from "vitest";
import { hasValidProductionTrustHost, resolveTrustHost } from "@/lib/auth-trust-host";

describe("kebijakan trustHost Auth.js", () => {
  it("mengaktifkan trustHost bila AUTH_URL (URL kanonis) diset", () => {
    const decision = resolveTrustHost({
      authUrl: "https://hillside-eden.example.com",
      nodeEnv: "production",
    });

    expect(decision.trustHost).toBe(true);
    expect(decision.reason).toBe("auth-url");
    expect(decision.canonicalUrl).toBe("https://hillside-eden.example.com");
  });

  it("menerima AUTH_URL dengan path dan tetap memakai origin sebagai URL kanonis", () => {
    const decision = resolveTrustHost({
      authUrl: "https://hillside-eden.example.com/app/",
      nodeEnv: "production",
    });

    expect(decision.trustHost).toBe(true);
    expect(decision.canonicalUrl).toBe("https://hillside-eden.example.com");
  });

  it("mengabaikan AUTH_URL yang bukan URL http(s) dan lanjut ke AUTH_TRUST_HOST", () => {
    const decision = resolveTrustHost({
      authUrl: "ftp://hillside-eden.example.com",
      authTrustHost: "true",
      nodeEnv: "production",
    });

    expect(decision.trustHost).toBe(true);
    expect(decision.reason).toBe("explicit-trust-host");
    expect(decision.canonicalUrl).toBeNull();
  });

  it("mengabaikan AUTH_URL yang bukan URL sama sekali", () => {
    const decision = resolveTrustHost({
      authUrl: "bukan-url",
      nodeEnv: "production",
    });

    expect(decision.trustHost).toBe(false);
    expect(decision.reason).toBe("untrusted");
  });

  it("mengaktifkan trustHost bila AUTH_TRUST_HOST=true", () => {
    const decision = resolveTrustHost({
      authTrustHost: "true",
      nodeEnv: "production",
    });

    expect(decision.trustHost).toBe(true);
    expect(decision.reason).toBe("explicit-trust-host");
  });

  it("tidak mengaktifkan trustHost bila AUTH_TRUST_HOST=false di produksi", () => {
    const decision = resolveTrustHost({
      authTrustHost: "false",
      nodeEnv: "production",
    });

    expect(decision.trustHost).toBe(false);
    expect(decision.reason).toBe("untrusted");
  });

  it("menolak nilai AUTH_TRUST_HOST selain true/false yang bermuatan lain", () => {
    const decision = resolveTrustHost({
      authTrustHost: "1",
      nodeEnv: "production",
    });

    expect(decision.trustHost).toBe(false);
  });

  it("mengaktifkan trustHost di luar produksi (fasilitas development Auth.js)", () => {
    const decision = resolveTrustHost({ nodeEnv: "development" });

    expect(decision.trustHost).toBe(true);
    expect(decision.reason).toBe("non-production");
  });

  it("menolak produksi tanpa AUTH_URL maupun AUTH_TRUST_HOST", () => {
    const decision = resolveTrustHost({ nodeEnv: "production" });

    expect(decision.trustHost).toBe(false);
    expect(decision.reason).toBe("untrusted");
  });

  it("mengabaikan nilai kosong/spasi", () => {
    const decision = resolveTrustHost({
      authUrl: "   ",
      authTrustHost: "  ",
      nodeEnv: "production",
    });

    expect(decision.trustHost).toBe(false);
  });
});

describe("syarat trustHost untuk produksi", () => {
  it("memenuhi syarat bila AUTH_URL diset", () => {
    expect(
      hasValidProductionTrustHost({
        authUrl: "https://hillside-eden.example.com",
        nodeEnv: "production",
      }),
    ).toBe(true);
  });

  it("memenuhi syarat bila AUTH_TRUST_HOST=true", () => {
    expect(
      hasValidProductionTrustHost({
        authTrustHost: "true",
        nodeEnv: "production",
      }),
    ).toBe(true);
  });

  it("tidak memenuhi syarat di produksi tanpa konfigurasi", () => {
    expect(hasValidProductionTrustHost({ nodeEnv: "production" })).toBe(false);
  });

  it("tidak menganggap konfigurasi development sebagai konfigurasi produksi yang valid", () => {
    // Di development Auth.js tetap boleh, tetapi konfigurasi produksi
    // (AUTH_URL / AUTH_TRUST_HOST) tetap wajib ada saat deploy.
    expect(hasValidProductionTrustHost({ nodeEnv: "development" })).toBe(false);
  });
});
