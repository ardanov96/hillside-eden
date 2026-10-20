/**
 * Skema validasi form "Tambah Booking" (S2-04.2).
 *
 * Layer ini terpisah dari adapter karena bekerja pada string FormData mentah,
 * bukan pada NormalizedBooking. Normalisasi amount terjadi di adapter.
 *
 * Prinsip:
 * - Semua pesan error Bahasa Indonesia & spesifik per-field (UI inline error).
 * - Tidak ada konversi tipe di sini; adapter yang menormalisasi.
 * - Field opsional yang kosong dianggap "tidak diisi", bukan 0.
 */
import { z } from "zod";

/** Helper: string dari FormData. String kosong -> undefined. */
export const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v));

/** Helper: nominal uang bebas format, divalidasi longgar di sini. */
export const moneyInput = z
  .string()
  .trim()
  .min(1, "Jumlah wajib diisi")
  .max(30, "Jumlah terlalu panjang")
  .regex(/^[\d.,\s]+$/, "Hanya angka dan pemisah ribuan yang diperbolehkan");

/** Helper: angka positif opsional. */
export const optionalPositiveInt = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
  .refine((v) => v === undefined || (Number.isInteger(v) && v > 0), "Harus bilangan bulat positif");

/** Skema utama form booking manual. */
export const bookingFormSchema = z
  .object({
    externalId: z
      .string()
      .trim()
      .min(1, "Kode referensi wajib diisi")
      .max(64, "Kode referensi terlalu panjang"),
    listingId: z.string().trim().min(1, "Pilih listing"),
    status: z.enum(["PENDING", "CONFIRMED"], {
      message: "Pilih status booking",
    }),
    checkIn: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal check-in tidak valid"),
    checkOut: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal check-out tidak valid"),
    currency: z
      .string()
      .trim()
      .length(3, "Kode mata uang harus 3 huruf")
      .transform((v) => v.toUpperCase()),
    grossAmount: moneyInput,
    cancellationFee: optionalText.pipe(moneyInput.optional()).optional(),
    commissionRate: optionalText.pipe(z.string().optional()).optional(),
    commissionAmount: optionalText.pipe(moneyInput.optional()).optional(),
    guestsCount: optionalPositiveInt,
    guestName: optionalText,
    collectType: z.enum(["CHANNEL_COLLECT", "HOTEL_COLLECT", "UNKNOWN"]).default("UNKNOWN"),
    bookedOn: optionalText,
    bookedAtIsApprox: z.coerce.boolean().default(true),
  })
  .superRefine((val, ctx) => {
    // checkOut harus setelah checkIn.
    if (val.checkOut <= val.checkIn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["checkOut"],
        message: "Tanggal check-out harus setelah check-in",
      });
    }
    // Tanggal pemesanan bila diisi harus format YYYY-MM-DD.
    if (val.bookedOn && !/^\d{4}-\d{2}-\d{2}$/.test(val.bookedOn)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bookedOn"],
        message: "Tanggal pemesanan tidak valid",
      });
    }
  });

export type BookingFormValues = z.input<typeof bookingFormSchema>;
export type BookingFormParsed = z.output<typeof bookingFormSchema>;

/** Ubah hasil validasi menjadi peta fieldErrors untuk UI. */
export function toFieldErrors(
  result: z.SafeParseReturnType<unknown, BookingFormParsed>,
): Record<string, string[]> {
  if (result.success) return {};
  const out: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_root";
    out[key] = [...(out[key] ?? []), issue.message];
  }
  return out;
}
