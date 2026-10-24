/**
 * Unit test untuk skrip Backup & Verifikasi Restore (S8-02).
 */
import { describe, expect, it, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

import { verifyBackupFile } from "../../scripts/restore-and-verify";

const TEST_BACKUP_PATH = path.join(process.cwd(), "test-backup-sample.json");

describe("verifyBackupFile", () => {
  afterEach(() => {
    if (existsSync(TEST_BACKUP_PATH)) {
      unlinkSync(TEST_BACKUP_PATH);
    }
  });

  it("memvalidasi backup yang sah dengan checksum dan matematika finansial yang seimbang", () => {
    const rawData = {
      organizations: [{ id: "org-1", name: "Hillside Eden Org" }],
      properties: [{ id: "prop-1", name: "Hillside Eden" }],
      bookings: [
        {
          id: "b-1",
          propertyId: "prop-1",
          grossAmount: "10000000",
          commissionAmount: "1500000",
          netAmount: "8500000",
        },
        {
          id: "b-2",
          propertyId: "prop-1",
          grossAmount: "5000000",
          commissionAmount: "700000",
          netAmount: "4300000",
        },
      ],
    };

    const payloadWithoutCheck = {
      metadata: {
        version: "1.0.0",
        timestamp: "2026-10-24T12:00:00.000Z",
        organizationId: "org-1",
        recordCounts: { bookings: 2 },
      },
      data: rawData,
    };

    const checksum = createHash("sha256")
      .update(JSON.stringify(payloadWithoutCheck, null, 2))
      .digest("hex");

    const fullBackup = {
      ...payloadWithoutCheck,
      metadata: {
        ...payloadWithoutCheck.metadata,
        checksum,
      },
    };

    writeFileSync(TEST_BACKUP_PATH, JSON.stringify(fullBackup, null, 2), "utf-8");

    const result = verifyBackupFile(TEST_BACKUP_PATH);
    expect(result.valid).toBe(true);
    expect(result.checksumMatches).toBe(true);
    expect(result.financialChecks.totalBookingsChecked).toBe(2);
    expect(result.financialChecks.totalGrossAmount).toBe("15000000");
    expect(result.financialChecks.totalCommissionAmount).toBe("2200000");
    expect(result.financialChecks.totalNetAmount).toBe("12800000");
    expect(result.financialChecks.grossNetCommissionBalanced).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("mendeteksi perubahan file tanpa checksum yang valid (tampering)", () => {
    const rawData = {
      properties: [{ id: "prop-1", name: "Hillside Eden" }],
      bookings: [
        {
          id: "b-1",
          propertyId: "prop-1",
          grossAmount: "10000000",
          commissionAmount: "1500000",
          netAmount: "8500000",
        },
      ],
    };

    const fullBackup = {
      metadata: {
        version: "1.0.0",
        timestamp: "2026-10-24T12:00:00.000Z",
        checksum: "invalid-checksum-value-1234567890",
      },
      data: rawData,
    };

    writeFileSync(TEST_BACKUP_PATH, JSON.stringify(fullBackup, null, 2), "utf-8");

    const result = verifyBackupFile(TEST_BACKUP_PATH);
    expect(result.valid).toBe(false);
    expect(result.checksumMatches).toBe(false);
    expect(result.errors[0]).toContain("Checksum tidak cocok");
  });

  it("mendeteksi ketidakcocokan matematis antara Gross dan Net + Komisi", () => {
    const rawData = {
      properties: [{ id: "prop-1", name: "Hillside Eden" }],
      bookings: [
        {
          id: "b-unbalanced",
          propertyId: "prop-1",
          grossAmount: "10000000",
          commissionAmount: "1500000",
          netAmount: "9000000", // Salah: 9M + 1.5M = 10.5M != 10M
        },
      ],
    };

    const payloadWithoutCheck = {
      metadata: {
        version: "1.0.0",
        timestamp: "2026-10-24T12:00:00.000Z",
        organizationId: "org-1",
      },
      data: rawData,
    };

    const checksum = createHash("sha256")
      .update(JSON.stringify(payloadWithoutCheck, null, 2))
      .digest("hex");

    const fullBackup = {
      ...payloadWithoutCheck,
      metadata: {
        ...payloadWithoutCheck.metadata,
        checksum,
      },
    };

    writeFileSync(TEST_BACKUP_PATH, JSON.stringify(fullBackup, null, 2), "utf-8");

    const result = verifyBackupFile(TEST_BACKUP_PATH);
    expect(result.valid).toBe(false);
    expect(result.financialChecks.grossNetCommissionBalanced).toBe(false);
    expect(result.errors.some((e) => e.includes("Ketidakcocokan nilai keuangan"))).toBe(true);
  });
});
