/**
 * Query server untuk halaman "Perlu Perhatian" / Karantina (S9-03 / S2-03).
 *
 * Mengambil item impor yang berstatus NEEDS_REVIEW atau FAILED.
 */
import { prisma } from "@/lib/prisma";
import type { ImportItemStatus } from "@prisma/client";

export interface AttentionItemSummary {
  id: string;
  batchId: string;
  status: ImportItemStatus;
  errorCode: string | null;
  errorMessage: string | null;
  receivedAt: Date;
  sourceKind: string;
  channel: string | null;
  filename: string | null;
  bookingDetails?: {
    externalId?: string;
    channel?: string;
    guestName?: string;
    checkIn?: string;
    checkOut?: string;
    grossAmount?: string;
    currency?: string;
    listingName?: string;
    externalListingId?: string;
  } | null;
  rawPayload: unknown;
}

export interface GetAttentionItemsOptions {
  status?: "ALL" | "NEEDS_REVIEW" | "FAILED";
  channel?: string | null;
  limit?: number;
}

export async function getAttentionItems(
  organizationId: string,
  options: GetAttentionItemsOptions = {},
): Promise<{
  items: AttentionItemSummary[];
  counts: { needsReview: number; failed: number; total: number };
}> {
  const { status = "ALL", channel, limit = 50 } = options;

  // Hitung total pending untuk badge
  const [needsReviewCount, failedCount] = await Promise.all([
    prisma.importItem.count({
      where: {
        batch: { organizationId },
        status: "NEEDS_REVIEW",
      },
    }),
    prisma.importItem.count({
      where: {
        batch: { organizationId },
        status: "FAILED",
      },
    }),
  ]);

  const statusFilter =
    status === "NEEDS_REVIEW"
      ? { status: "NEEDS_REVIEW" as const }
      : status === "FAILED"
        ? { status: "FAILED" as const }
        : { status: { in: ["NEEDS_REVIEW" as const, "FAILED" as const] } };

  const rows = await prisma.importItem.findMany({
    where: {
      batch: {
        organizationId,
        ...(channel ? { channel: channel as never } : {}),
      },
      ...statusFilter,
    },
    include: {
      batch: {
        select: {
          id: true,
          kind: true,
          channel: true,
          filename: true,
          receivedAt: true,
        },
      },
    },
    orderBy: { batch: { receivedAt: "desc" } },
    take: limit,
  });

  const items: AttentionItemSummary[] = rows.map((r) => {
    const payload = (
      r.parsedPayload && typeof r.parsedPayload === "object" ? r.parsedPayload : {}
    ) as Record<string, unknown>;

    // Coba ekstrak booking dari parsedPayload (ParsedBookingEvent)
    const booking = (
      payload.booking && typeof payload.booking === "object" ? payload.booking : payload
    ) as Record<string, unknown>;

    let bookingDetails: AttentionItemSummary["bookingDetails"] = null;
    if (booking.externalId || booking.checkIn || booking.guestName) {
      bookingDetails = {
        externalId: typeof booking.externalId === "string" ? booking.externalId : undefined,
        channel: typeof booking.channel === "string" ? booking.channel : undefined,
        guestName: typeof booking.guestName === "string" ? booking.guestName : undefined,
        checkIn: typeof booking.checkIn === "string" ? booking.checkIn : undefined,
        checkOut: typeof booking.checkOut === "string" ? booking.checkOut : undefined,
        grossAmount: typeof booking.grossAmount === "string" ? booking.grossAmount : undefined,
        currency: typeof booking.currency === "string" ? booking.currency : undefined,
        listingName: typeof booking.listingName === "string" ? booking.listingName : undefined,
        externalListingId:
          typeof booking.externalListingId === "string" ? booking.externalListingId : undefined,
      };
    }

    return {
      id: r.id,
      batchId: r.batchId,
      status: r.status,
      errorCode: r.errorCode,
      errorMessage: r.errorMessage,
      receivedAt: r.batch.receivedAt,
      sourceKind: r.batch.kind,
      channel: r.batch.channel,
      filename: r.batch.filename,
      bookingDetails,
      rawPayload: r.parsedPayload,
    };
  });

  return {
    items,
    counts: {
      needsReview: needsReviewCount,
      failed: failedCount,
      total: needsReviewCount + failedCount,
    },
  };
}
