/**
 * Skema parser untuk searchParams halaman Bookings (S2-07.2 + S4-01).
 *
 * URL query string -> parameter yang dipakai oleh getBookings().
 * Dipisah dari query layer supaya URL parsing dapat diuji tanpa Prisma.
 *
 * Sumber kebenaran: docs/07-ui-spec.md §3.2.
 * - Filter lokal halaman: OTA, status, pencarian kode konfirmasi.
 * - Filter global (properti + rentang tanggal menginap) TIDAK di sini -
 *   lihat src/lib/filters/global-filter.ts. Halaman Bookings menerima
 *   DateRange yang sudah diselesaikan dari sana.
 * - Sort: checkIn | checkOut | grossAmount | lastSeenAt (asc/desc).
 */
import { z } from "zod";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/server/queries/bookings";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v));

const sortSchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v))
  .pipe(
    z.union([z.string(), z.undefined()]).transform((v) => {
      if (!v) return undefined;
      const [keyRaw, dirRaw] = v.split(":");
      const key = (keyRaw ?? "").trim();
      const dir = (dirRaw ?? "desc").trim().toLowerCase();
      const allowedKeys = ["checkIn", "checkOut", "grossAmount", "lastSeenAt"];
      if (!allowedKeys.includes(key)) return undefined;
      if (dir !== "asc" && dir !== "desc") return undefined;
      return {
        key: key as "checkIn" | "checkOut" | "grossAmount" | "lastSeenAt",
        dir: dir as "asc" | "desc",
      };
    }),
  );

/** Konstanta channel yang dipakai untuk filter dropdown (subset OTA + manual). */
export const BOOKING_CHANNEL_VALUES = [
  "AIRBNB",
  "TIKET_COM",
  "TRAVELOKA",
  "EXPEDIA",
  "AGODA",
  "BOOKING_COM",
  "DIRECT",
  "MANUAL",
] as const;

export const BOOKING_STATUS_VALUES = ["PENDING", "CONFIRMED", "CANCELLED", "NO_SHOW"] as const;

/**
 * Skema untuk searchParams URL halaman Bookings. Filter properti
 * dan rentang tanggal menginap dibaca lewat global filter
 * (src/lib/filters/global-filter.ts), bukan dari sini.
 */
export const bookingListSearchSchema = z.object({
  channel: z
    .enum(BOOKING_CHANNEL_VALUES)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  status: z
    .enum(BOOKING_STATUS_VALUES)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  search: optionalString,
  page: z.coerce.number().int().positive().max(10_000).optional().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_PAGE_SIZE)
    .optional()
    .default(DEFAULT_PAGE_SIZE),
  sort: sortSchema,
});

export type BookingListSearchInput = z.input<typeof bookingListSearchSchema>;
export type BookingListSearchParsed = z.output<typeof bookingListSearchSchema>;

/** Parse satu objek searchParams mentah (Next style). */
export function parseBookingListSearch(
  raw: Record<string, string | string[] | undefined>,
): BookingListSearchParsed {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    flat[k] = Array.isArray(v) ? v[0] : v;
  }
  return bookingListSearchSchema.parse(flat);
}

/**
 * Versi aman: tidak melempar, mengembalikan `{ ok, data }` ala useActionState.
 * Dipakai server component agar kesalahan parse tidak crash halaman.
 */
export function safeParseBookingListSearch(
  raw: Record<string, string | string[] | undefined>,
): { ok: true; data: BookingListSearchParsed } | { ok: false; issues: string[] } {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    flat[k] = Array.isArray(v) ? v[0] : v;
  }
  const r = bookingListSearchSchema.safeParse(flat);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, issues: r.error.issues.map((i) => i.message) };
}
