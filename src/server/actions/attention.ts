"use server";

/**
 * Server Actions untuk Halaman "Perlu Perhatian" / Karantina (S9-03 / S2-03).
 *
 * Mengelola penyelesaian item impor yang membutuhkan intervensi manusia
 * (pemetaan ulang listing tak dikenal, atau pengabaian data bermasalah).
 */
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withSerializableTransaction } from "@/server/prisma-tx";
import { applyBookingEvent } from "@/ingest/pipeline/upsert";
import { writeAudit, AUDIT_ACTIONS } from "@/ingest/pipeline/audit";
import type { NormalizedBooking, EventType } from "@/adapters/types";

export interface AttentionActionResult {
  success: boolean;
  message: string;
}

/**
 * Petakan item karantina ke sebuah listing fisik dan proses ulang ke sistem booking.
 */
export async function resolveAndReprocessItemAction(input: {
  itemId: string;
  targetListingId: string;
}): Promise<AttentionActionResult> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Sesi tidak valid. Silakan masuk kembali." };
  }
  const organizationId = session.user.organizationId;
  const actorId = session.user.id ?? null;

  const { itemId, targetListingId } = input;
  if (!itemId || !targetListingId) {
    return { success: false, message: "Parameter tidak lengkap." };
  }

  // 1. Ambil data item karantina
  const item = await prisma.importItem.findFirst({
    where: {
      id: itemId,
      batch: { organizationId },
    },
    include: { batch: true },
  });

  if (!item) {
    return { success: false, message: "Item karantina tidak ditemukan." };
  }

  // 2. Ambil target listing dan pastikan milik organisasi
  const targetListing = await prisma.listing.findFirst({
    where: {
      id: targetListingId,
      organizationId,
    },
    select: {
      id: true,
      name: true,
      propertyId: true,
    },
  });

  if (!targetListing) {
    return { success: false, message: "Target listing tidak valid atau tidak ditemukan." };
  }

  // 3. Ekstrak payload event
  const payload = (
    item.parsedPayload && typeof item.parsedPayload === "object" ? item.parsedPayload : {}
  ) as Record<string, unknown>;

  const booking = (
    payload.booking && typeof payload.booking === "object" ? payload.booking : null
  ) as NormalizedBooking | null;

  if (!booking || !booking.externalId || !booking.checkIn || !booking.checkOut) {
    return {
      success: false,
      message: "Data reservasi di dalam item tidak lengkap untuk diproses ulang.",
    };
  }

  const eventType: EventType =
    payload.eventType === "MODIFIED" ||
    payload.eventType === "CANCELLED" ||
    payload.eventType === "NO_SHOW"
      ? (payload.eventType as EventType)
      : "CREATED";

  const occurredAt = payload.occurredAt ? new Date(payload.occurredAt as string) : new Date();

  // 4. Terapkan event dalam transaksi serializable
  try {
    await withSerializableTransaction(prisma, async (tx) => {
      // Apply booking event
      await applyBookingEvent(tx as never, {
        organizationId,
        listingId: targetListing.id,
        propertyId: targetListing.propertyId,
        booking,
        eventType,
        occurredAt,
        importItemId: item.id,
        actorId,
        sourceAdapterId: "manual.reprocess",
      });

      // Update status item menjadi PARSED
      await tx.importItem.update({
        where: { id: item.id },
        data: {
          status: "PARSED",
          errorCode: null,
          errorMessage: null,
        },
      });

      // Log audit
      await writeAudit(tx as never, {
        organizationId,
        actorId,
        action: AUDIT_ACTIONS.importItemReprocessed,
        entityType: "ImportItem",
        entityId: item.id,
        before: {
          status: item.status,
          errorCode: item.errorCode,
        },
        after: {
          status: "PARSED",
          targetListingId: targetListing.id,
          targetListingName: targetListing.name,
        },
      });
    });

    revalidatePath("/attention");
    revalidatePath("/bookings");
    revalidatePath("/");

    return {
      success: true,
      message: `Item berhasil dipetakan ke '${targetListing.name}' dan dimasukkan ke daftar booking.`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Gagal memproses ulang item: ${(err as Error).message}`,
    };
  }
}

/**
 * Tandai item karantina sebagai diabaikan (dismiss).
 */
export async function dismissAttentionItemAction(input: {
  itemId: string;
  reason: string;
}): Promise<AttentionActionResult> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Sesi tidak valid. Silakan masuk kembali." };
  }
  const organizationId = session.user.organizationId;
  const actorId = session.user.id ?? null;

  const { itemId, reason } = input;
  if (!itemId) {
    return { success: false, message: "ID item tidak boleh kosong." };
  }

  const item = await prisma.importItem.findFirst({
    where: {
      id: itemId,
      batch: { organizationId },
    },
  });

  if (!item) {
    return { success: false, message: "Item tidak ditemukan." };
  }

  const dismissReason = reason.trim() || "Diabaikan oleh pengguna";

  await prisma.importItem.update({
    where: { id: item.id },
    data: {
      status: "DUPLICATE",
      errorCode: "DISMISSED",
      errorMessage: `[Diabaikan]: ${dismissReason}`,
    },
  });

  await writeAudit(prisma, {
    organizationId,
    actorId,
    action: AUDIT_ACTIONS.importItemIgnored,
    entityType: "ImportItem",
    entityId: item.id,
    before: { status: item.status, errorCode: item.errorCode },
    after: { status: "DUPLICATE", reason: dismissReason },
  });

  revalidatePath("/attention");

  return {
    success: true,
    message: "Item berhasil ditandai sebagai diabaikan.",
  };
}
