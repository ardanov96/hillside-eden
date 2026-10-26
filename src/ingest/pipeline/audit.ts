/**
 * pipeline/audit.ts (S2-02.6).
 *
 * Pembungkus AuditLog (ADR-008) untuk pipeline ingest. Setiap mutasi data
 * keuangan / struktural yang dilakukan pipeline WAJIB meninggalkan jejak
 * audit (lihat docs/05 §7 dan docs/08 §4).
 *
 * Prinsip:
 * - Nama aksi memakai "<entity>.<verb>" agar mudah difilter, mis.
 *   "booking.created", "import_item.quarantined".
 * - before/after di-serialize ke Json (Decimal -> string agar presisi utuh).
 * - Audit ditulis DALAM transaksi yang sama bila caller menyediakannya;
 *   jika caller tidak menyediakan tx, tulis di luar (tapi jangan dipakai
 *   untuk mutasi keuangan utama).
 */
import type { Prisma } from "@prisma/client";
import { Decimal } from "@/lib/decimal";

/**
 * Delegate minimal AuditLog agar bisa dipakai dengan PrismaClient maupun
 * Prisma.TransactionClient. Sengaja longgar (unknown pada data) supaya
 * signature generik Prisma tetap assignable tanpa cast di call site.
 */
export interface AuditLogDelegate {
  auditLog: {
    create(args: { data: unknown }): Promise<unknown>;
  };
}

/** Daftar aksi audit yang dipakai pipeline (konstan, agar tidak salah ketik). */
export const AUDIT_ACTIONS = {
  bookingCreated: "booking.created",
  bookingUpdated: "booking.updated",
  bookingCancelled: "booking.cancelled",
  importBatchStarted: "import_batch.started",
  importBatchFinished: "import_batch.finished",
  importItemQuarantined: "import_item.quarantined",
  importItemReprocessed: "import_item.reprocessed",
  importItemIgnored: "import_item.ignored",
  importItemFailed: "import_item.failed",
  payoutCreated: "payout.created",
  payoutLinked: "payout.linked",
  commissionRuleCreated: "commission_rule.created",
  commissionRuleUpdated: "commission_rule.updated",
  commissionRuleDeleted: "commission_rule.deleted",
  periodLocked: "period.locked",
  periodUnlocked: "period.unlocked",
  guestAnonymized: "guest.anonymized",
  expenseCreated: "expense.created",
  expenseUpdated: "expense.updated",
  expenseVerified: "expense.verified",
  expenseReversed: "expense.reversed",
  expenseDeleted: "expense.deleted",
  otherIncomeCreated: "other_income.created",
  otherIncomeReversed: "other_income.reversed",
  recurringTemplateCreated: "recurring_template.created",
  recurringTemplateDeleted: "recurring_template.deleted",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface WriteAuditInput {
  organizationId: string;
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Ubah nilai Decimal jadi string agar presisi tidak hilang saat disimpan
 * sebagai Json (Prisma Decimal -> JSON number bisa kehilangan presisi).
 * Date -> ISO string.
 */
function toAuditJson(value: unknown): Prisma.InputJsonValue | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Decimal) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((v) => toAuditJson(v) ?? null) as unknown as Prisma.InputJsonValue;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object") {
    const out: Record<string, Prisma.InputJsonValue | null> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const j = toAuditJson(v);
      if (j !== undefined) out[k] = j;
    }
    return out as Prisma.InputJsonValue;
  }
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

/**
 * Tulis satu entri AuditLog.
 * `db` boleh PrismaClient atau Prisma TransactionClient (keduanya punya
 * delegate auditLog dengan signature create yang sama).
 */
export async function writeAudit(db: AuditLogDelegate, input: WriteAuditInput): Promise<void> {
  const before = toAuditJson(input.before);
  const after = toAuditJson(input.after);
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      ...(input.actorId ? { actorId: input.actorId } : {}),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ...(before === undefined ? {} : { before }),
      ...(after === undefined ? {} : { after }),
    },
  });
}

/** Helper: audit untuk batch ingest yang baru dimulai. */
export async function auditBatchStarted(
  db: AuditLogDelegate,
  args: { organizationId: string; batchId: string; kind: string; actorId?: string | null },
): Promise<void> {
  await writeAudit(db, {
    organizationId: args.organizationId,
    ...(args.actorId ? { actorId: args.actorId } : {}),
    action: AUDIT_ACTIONS.importBatchStarted,
    entityType: "ImportBatch",
    entityId: args.batchId,
    after: { kind: args.kind },
  });
}

/** Helper: audit untuk batch ingest yang selesai (dengan ringkasan stats). */
export async function auditBatchFinished(
  db: AuditLogDelegate,
  args: {
    organizationId: string;
    batchId: string;
    stats: unknown;
    actorId?: string | null;
  },
): Promise<void> {
  await writeAudit(db, {
    organizationId: args.organizationId,
    ...(args.actorId ? { actorId: args.actorId } : {}),
    action: AUDIT_ACTIONS.importBatchFinished,
    entityType: "ImportBatch",
    entityId: args.batchId,
    after: args.stats,
  });
}

/** Helper: audit untuk pemrosesan quarantine (reprocess / ignore / failed). */
export async function auditQuarantineAction(
  db: AuditLogDelegate,
  args: {
    organizationId: string;
    importItemId: string;
    kind: "reprocessed" | "ignored" | "failed";
    actorId?: string | null;
    reason?: string;
    extra?: Record<string, unknown>;
  },
): Promise<void> {
  const action =
    args.kind === "reprocessed"
      ? AUDIT_ACTIONS.importItemReprocessed
      : args.kind === "ignored"
        ? AUDIT_ACTIONS.importItemIgnored
        : AUDIT_ACTIONS.importItemFailed;
  await writeAudit(db, {
    organizationId: args.organizationId,
    ...(args.actorId ? { actorId: args.actorId } : {}),
    action,
    entityType: "ImportItem",
    entityId: args.importItemId,
    after: {
      ...(args.reason ? { reason: args.reason } : {}),
      ...(args.extra ?? {}),
    },
  });
}
