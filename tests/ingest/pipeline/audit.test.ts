/**
 * Unit test untuk audit.ts (S2-02.6) memakai delegate auditLog palsu.
 * Tidak butuh DB.
 */
import { describe, expect, it } from "vitest";
import { Decimal } from "@/lib/decimal";
import {
  AUDIT_ACTIONS,
  auditBatchFinished,
  auditBatchStarted,
  auditQuarantineAction,
  writeAudit,
  type AuditLogDelegate,
} from "@/ingest/pipeline/audit";

interface CapturedRow {
  organizationId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

function fakeDb() {
  const rows: CapturedRow[] = [];
  const db: AuditLogDelegate = {
    auditLog: {
      async create({ data }) {
        rows.push(data as CapturedRow);
        return data;
      },
    },
  };
  return { db, rows };
}

describe("writeAudit", () => {
  it("menulis baris audit dengan field minimal", async () => {
    const { db, rows } = fakeDb();
    await writeAudit(db, {
      organizationId: "org-1",
      action: AUDIT_ACTIONS.bookingCreated,
      entityType: "Booking",
      entityId: "B1",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      organizationId: "org-1",
      action: "booking.created",
      entityType: "Booking",
      entityId: "B1",
    });
    expect(rows[0]?.before).toBeUndefined();
    expect(rows[0]?.after).toBeUndefined();
  });

  it("menyertakan actorId bila diberikan", async () => {
    const { db, rows } = fakeDb();
    await writeAudit(db, {
      organizationId: "org-1",
      actorId: "user-1",
      action: AUDIT_ACTIONS.bookingUpdated,
      entityType: "Booking",
      entityId: "B1",
    });
    expect(rows[0]?.actorId).toBe("user-1");
  });

  it("mengonversi Decimal -> string agar presisi tidak hilang", async () => {
    const { db, rows } = fakeDb();
    await writeAudit(db, {
      organizationId: "org-1",
      action: AUDIT_ACTIONS.bookingUpdated,
      entityType: "Booking",
      entityId: "B1",
      before: { grossAmount: new Decimal("1234567.89") },
      after: { grossAmount: new Decimal("2000000.00") },
    });
    expect(rows[0]?.before).toEqual({ grossAmount: "1234567.89" });
    expect(rows[0]?.after).toEqual({ grossAmount: "2000000" });
  });

  it("mengonversi Date -> ISO string", async () => {
    const { db, rows } = fakeDb();
    const d = new Date("2026-10-19T08:00:00.000Z");
    await writeAudit(db, {
      organizationId: "org-1",
      action: AUDIT_ACTIONS.bookingCreated,
      entityType: "Booking",
      entityId: "B1",
      after: { checkIn: d },
    });
    expect(rows[0]?.after).toEqual({ checkIn: "2026-10-19T08:00:00.000Z" });
  });

  it("mengonversi bigint -> string (JSON-safe)", async () => {
    const { db, rows } = fakeDb();
    await writeAudit(db, {
      organizationId: "org-1",
      action: AUDIT_ACTIONS.payoutCreated,
      entityType: "Payout",
      entityId: "P1",
      after: { big: 123456789012345678901n },
    });
    expect(rows[0]?.after).toEqual({ big: "123456789012345678901" });
  });

  it("menangani array dan nested object", async () => {
    const { db, rows } = fakeDb();
    await writeAudit(db, {
      organizationId: "org-1",
      action: AUDIT_ACTIONS.bookingUpdated,
      entityType: "Booking",
      entityId: "B1",
      after: {
        units: [
          { unitId: "U1", amount: new Decimal("750000") },
          { unitId: "U2", amount: new Decimal("750000") },
        ],
        meta: { source: "airbnb.email.v1", nested: { ok: true } },
      },
    });
    expect(rows[0]?.after).toEqual({
      units: [
        { unitId: "U1", amount: "750000" },
        { unitId: "U2", amount: "750000" },
      ],
      meta: { source: "airbnb.email.v1", nested: { ok: true } },
    });
  });

  it("membuang key dengan nilai undefined", async () => {
    const { db, rows } = fakeDb();
    await writeAudit(db, {
      organizationId: "org-1",
      action: AUDIT_ACTIONS.bookingCreated,
      entityType: "Booking",
      entityId: "B1",
      after: { a: 1, b: undefined },
    });
    expect(rows[0]?.after).toEqual({ a: 1 });
  });

  it("null tetap disimpan sebagai null (bukan undefined)", async () => {
    const { db, rows } = fakeDb();
    await writeAudit(db, {
      organizationId: "org-1",
      action: AUDIT_ACTIONS.bookingUpdated,
      entityType: "Booking",
      entityId: "B1",
      before: { commissionRate: null },
    });
    expect(rows[0]?.before).toEqual({ commissionRate: null });
  });
});

describe("auditBatchStarted / auditBatchFinished", () => {
  it("menggunakan aksi & entityType yang benar", async () => {
    const { db, rows } = fakeDb();
    await auditBatchStarted(db, {
      organizationId: "org-1",
      batchId: "BATCH1",
      kind: "CSV",
    });
    await auditBatchFinished(db, {
      organizationId: "org-1",
      batchId: "BATCH1",
      stats: { total: 10, created: 8, duplicate: 1, failed: 1 },
    });
    expect(rows[0]?.action).toBe(AUDIT_ACTIONS.importBatchStarted);
    expect(rows[0]?.entityType).toBe("ImportBatch");
    expect(rows[1]?.action).toBe(AUDIT_ACTIONS.importBatchFinished);
    expect(rows[1]?.after).toEqual({ total: 10, created: 8, duplicate: 1, failed: 1 });
  });
});

describe("auditQuarantineAction", () => {
  it("memetakan kind 'reprocessed'", async () => {
    const { db, rows } = fakeDb();
    await auditQuarantineAction(db, {
      organizationId: "org-1",
      importItemId: "I1",
      kind: "reprocessed",
      actorId: "user-1",
      reason: "Mapping listing sudah ditambahkan",
    });
    expect(rows[0]?.action).toBe(AUDIT_ACTIONS.importItemReprocessed);
    expect(rows[0]?.after).toEqual({ reason: "Mapping listing sudah ditambahkan" });
  });

  it("memetakan kind 'ignored' dengan alasan wajib", async () => {
    const { db, rows } = fakeDb();
    await auditQuarantineAction(db, {
      organizationId: "org-1",
      importItemId: "I1",
      kind: "ignored",
      actorId: "user-1",
      reason: "Data duplik dari batch sebelumnya",
    });
    expect(rows[0]?.action).toBe(AUDIT_ACTIONS.importItemIgnored);
  });

  it("memetakan kind 'failed'", async () => {
    const { db, rows } = fakeDb();
    await auditQuarantineAction(db, {
      organizationId: "org-1",
      importItemId: "I1",
      kind: "failed",
    });
    expect(rows[0]?.action).toBe(AUDIT_ACTIONS.importItemFailed);
  });
});
