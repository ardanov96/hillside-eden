/**
 * Unit test skrip generator secret (scripts/generate-secrets.ts).
 *
 * Yang diuji (fungsi murni, tanpa akses disk):
 * - deteksi variabel aktif vs komentar,
 * - pendeteksian nilai placeholder,
 * - rencana pengisian (hanya secret yang belum ada/placeholder yang berubah),
 * - laporan tidak membocorkan nilai rahasia kecuali `--show`.
 */
import { describe, expect, it } from "vitest";
import {
  findActiveValue,
  formatReport,
  generateSecretValue,
  isPlaceholderValue,
  planSecretGeneration,
  SECRET_SPECS,
  upsertEnvValue,
} from "../../scripts/generate-secrets";

const SPEC = SECRET_SPECS.find((s) => s.key === "ENCRYPTION_KEY")!;
const WEBHOOK_SPEC = SECRET_SPECS.find((s) => s.key === "DIRECT_BOOKING_WEBHOOK_SECRET")!;

describe("generate-secrets: pembacaan env", () => {
  it("membaca nilai aktif", () => {
    const content = ['AUTH_SECRET="abc123"', "LAIN=1"].join("\n");
    expect(findActiveValue(content, "AUTH_SECRET")).toBe("abc123");
  });

  it("mengabaikan baris berkomentar", () => {
    const content = ['# ENCRYPTION_KEY="komentar"', 'ENCRYPTION_KEY="aktif"'].join("\n");
    expect(findActiveValue(content, "ENCRYPTION_KEY")).toBe("aktif");
  });

  it("mengembalikan null untuk variabel yang tidak ada", () => {
    expect(findActiveValue("LAIN=1", "ENCRYPTION_KEY")).toBeNull();
  });

  it("menganggap nilai kosong sebagai tidak ada", () => {
    expect(findActiveValue('ENCRYPTION_KEY=""', "ENCRYPTION_KEY")).toBeNull();
    expect(findActiveValue("ENCRYPTION_KEY=", "ENCRYPTION_KEY")).toBeNull();
  });
});

describe("generate-secrets: nilai placeholder", () => {
  it("menandai nilai placeholder", () => {
    expect(isPlaceholderValue("ganti-dengan-hasil-random")).toBe(true);
    expect(isPlaceholderValue("isi-dengan-openssl-rand-hex-32")).toBe(true);
    expect(isPlaceholderValue("CHANGE_ME")).toBe(true);
    expect(isPlaceholderValue("TODO")).toBe(true);
    expect(isPlaceholderValue("xxxx")).toBe(true);
    expect(isPlaceholderValue("")).toBe(true);
  });

  it("tidak menandai nilai acak sebagai placeholder", () => {
    expect(
      isPlaceholderValue("5f2b8c1d9a0e4f7c3b6d2e8a1f4c7b90d2e5a8c1f4b7d0e3a6c9f2b5d8e1a4c7"),
    ).toBe(false);
  });
});

describe("generate-secrets: nilai acak", () => {
  it("menghasilkan nilai sepanjang minimum dan berbeda antar panggilan", () => {
    const a = generateSecretValue(SPEC);
    const b = generateSecretValue(SPEC);

    expect(a.length).toBeGreaterThanOrEqual(SPEC.minLength);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]+$/);
  });

  it("menghasilkan secret webhook minimal 16 karakter", () => {
    expect(generateSecretValue(WEBHOOK_SPEC).length).toBeGreaterThanOrEqual(16);
  });
});

describe("generate-secrets: rencana pengisian", () => {
  it("menambah variabel yang belum ada", () => {
    const content = 'AUTH_SECRET="sudah-ada"\n';
    const { actions, updatedContent } = planSecretGeneration(content, [SPEC]);

    expect(actions).toHaveLength(1);
    expect(actions[0]?.reason).toBe("missing");
    expect(updatedContent).toContain('ENCRYPTION_KEY="');
    expect(findActiveValue(updatedContent, "ENCRYPTION_KEY")).toBeTruthy();
    // Baris lama tetap utuh.
    expect(updatedContent).toContain('AUTH_SECRET="sudah-ada"');
  });

  it("tidak menimpa nilai yang sudah ada", () => {
    const content = 'ENCRYPTION_KEY="nilai-yang-sudah-ada"\n';
    const { actions, updatedContent } = planSecretGeneration(content, [SPEC]);

    expect(actions[0]?.reason).toBe("kept");
    expect(updatedContent).toBe(content);
  });

  it("mengganti nilai placeholder", () => {
    const content = 'ENCRYPTION_KEY="ganti-dengan-openssl-rand-hex-32"\n';
    const { actions, updatedContent } = planSecretGeneration(content, [SPEC]);

    expect(actions[0]?.reason).toBe("placeholder");
    expect(findActiveValue(updatedContent, "ENCRYPTION_KEY")).not.toBe(
      "ganti-dengan-openssl-rand-hex-32",
    );
  });

  it("--force mengenerate ulang nilai yang sudah ada", () => {
    const content = 'ENCRYPTION_KEY="nilai-yang-sudah-ada"\n';
    const { actions, updatedContent } = planSecretGeneration(content, [SPEC], { force: true });

    expect(actions[0]?.reason).toBe("forced");
    expect(findActiveValue(updatedContent, "ENCRYPTION_KEY")).not.toBe("nilai-yang-sudah-ada");
  });

  it("mengganti variabel aktif di tempat tanpa merusak baris lain", () => {
    const content = ["# komentar", 'ENCRYPTION_KEY="lama"', "LAIN=1"].join("\n");
    const updated = upsertEnvValue(content, "ENCRYPTION_KEY", "baru");

    expect(updated).toContain("# komentar");
    expect(updated).toContain("LAIN=1");
    expect(updated).toContain('ENCRYPTION_KEY="baru"');
    expect(updated).not.toContain('ENCRYPTION_KEY="lama"');
  });

  it("mempertahankan akhir baris CRLF", () => {
    const content = 'LAIN=1\r\nENCRYPTION_KEY="lama"\r\n';
    const updated = upsertEnvValue(content, "ENCRYPTION_KEY", "baru");

    expect(updated).toContain("\r\n");
    expect(updated).not.toMatch(/[^\r]\n/);
  });

  it("menyisipkan variabel baru di akhir berkas", () => {
    const content = "LAIN=1\n";
    const updated = upsertEnvValue(content, "OTA_VAULT_KEY", "kunci");

    expect(updated.trim().split("\n")).toHaveLength(2);
    expect(updated).toContain('OTA_VAULT_KEY="kunci"');
  });
});

describe("generate-secrets: laporan", () => {
  it("tidak membocorkan nilai rahasia secara default", () => {
    const { actions } = planSecretGeneration("", [SPEC]);
    const report = formatReport(actions).join("\n");

    expect(report).toContain("ENCRYPTION_KEY");
    expect(report).not.toContain(actions[0]!.value!);
  });

  it("menampilkan nilai hanya bila diminta (--show)", () => {
    const { actions } = planSecretGeneration("", [SPEC]);
    const report = formatReport(actions, true).join("\n");

    expect(report).toContain(actions[0]!.value!);
  });

  it("menandai nilai yang dipertahankan", () => {
    const { actions } = planSecretGeneration('ENCRYPTION_KEY="nyata"\n', [SPEC]);
    expect(formatReport(actions).join("\n")).toContain("sudah ada");
  });
});
