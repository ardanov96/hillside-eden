"use server";
/**
 * Server Action: Tambah Booking Manual (S2-04.3).
 *
 * Alur:
 * 1. auth() -> organisasi & user dari JWT (bukan dari input form).
 * 2. Validasi FormData dengan bookingFormSchema (Zod).
 * 3. Jalankan pipeline.runIngest dengan RawInput "manual" +
 *    ManualBookingAdapter via router.
 * 4. Redirect ke /bookings/<id> bila sukses; kembali dengan error bila gagal.
 *
 * Catatan keamanan:
 * - organizationId TIDAK pernah diambil dari FormData (anti-tenant-leak).
 * - listingId divalidasi ulang oleh resolveListing (pipeline) terhadap org.
 */
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { bookingFormSchema, toFieldErrors } from "@/lib/forms/booking-form-schema";
import { ManualBookingAdapter, type ManualBookingInput } from "@/adapters/manual";
import { createRouterRegistry } from "@/ingest/pipeline/router";
import { runIngest } from "@/ingest/pipeline/pipeline";

export type BookingFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Nilai form yang dikembalikan supaya input tidak hilang saat gagal. */
  values?: Record<string, string>;
};

/** Ekstrak nilai form sebagai string (untuk re-populate & return state). */
function collectValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export async function createManualBookingAction(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  const userId = session?.user?.id ?? null;

  if (!organizationId) {
    return { error: "Sesi tidak valid. Silakan masuk kembali." };
  }

  const values = collectValues(formData);
  const parsed = bookingFormSchema.safeParse({
    externalId: formData.get("externalId"),
    listingId: formData.get("listingId"),
    status: formData.get("status"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    currency: formData.get("currency"),
    grossAmount: formData.get("grossAmount"),
    cancellationFee: formData.get("cancellationFee"),
    commissionRate: formData.get("commissionRate"),
    commissionAmount: formData.get("commissionAmount"),
    guestsCount: formData.get("guestsCount"),
    guestName: formData.get("guestName"),
    collectType: formData.get("collectType") ?? "UNKNOWN",
    bookedOn: formData.get("bookedOn"),
    bookedAtIsApprox: formData.get("bookedAtIsApprox") === "on",
  });

  if (!parsed.success) {
    return {
      error: "Periksa kembali isian formulir.",
      fieldErrors: toFieldErrors(parsed),
      values,
    };
  }

  const data = parsed.data;
  const payload: ManualBookingInput = {
    externalId: data.externalId,
    listingId: data.listingId,
    status: data.status,
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    currency: data.currency,
    grossAmount: data.grossAmount,
    ...(data.cancellationFee !== undefined ? { cancellationFee: data.cancellationFee } : {}),
    ...(data.commissionRate !== undefined ? { commissionRate: data.commissionRate } : {}),
    ...(data.commissionAmount !== undefined ? { commissionAmount: data.commissionAmount } : {}),
    ...(data.guestsCount !== undefined ? { guestsCount: data.guestsCount } : {}),
    ...(data.guestName !== undefined ? { guestName: data.guestName } : {}),
    ...(data.collectType ? { collectType: data.collectType } : {}),
    ...(data.bookedOn !== undefined ? { bookedOn: data.bookedOn } : {}),
    bookedAtIsApprox: data.bookedAtIsApprox,
  };

  // Validasi listing milik organisasi sebelum menjalankan pipeline, agar
  // pesan error enak dibaca pengguna (pipeline tetap memvalidasi ulang).
  const listing = await prisma.listing.findFirst({
    where: { id: data.listingId, organizationId },
    select: { id: true },
  });
  if (!listing) {
    return {
      error: "Listing tidak ditemukan atau tidak tersedia.",
      fieldErrors: { listingId: ["Pilih listing yang tersedia"] },
      values,
    };
  }

  const router = createRouterRegistry([new ManualBookingAdapter()]);

  let result;
  try {
    result = await runIngest(prisma, router, {
      organizationId,
      actorId: userId,
      kind: "MANUAL",
      channel: "MANUAL",
      filename: null,
      storageKey: null,
      rawInput: { kind: "manual", payload },
      manualListingId: data.listingId,
    });
  } catch (err) {
    return {
      error: `Gagal menyimpan booking: ${err instanceof Error ? err.message : "kesalahan tidak dikenal"}`,
      values,
    };
  }

  if (result.created === 0 && result.updated === 0) {
    const first = result.errors[0];
    return {
      error: first?.message ?? "Booking tidak dapat diproses.",
      values,
    };
  }

  // Ambil booking terbaru untuk externalId tersebut agar redirect tepat.
  const booking = await prisma.booking.findFirst({
    where: {
      organizationId,
      channel: "MANUAL",
      externalId: data.externalId,
    },
    select: { id: true },
    orderBy: { lastSeenAt: "desc" },
  });

  if (!booking) {
    redirect("/bookings");
  }
  redirect(`/bookings/${booking.id}`);
}
