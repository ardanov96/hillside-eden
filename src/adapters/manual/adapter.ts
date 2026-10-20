/**
 * Adapter MANUAL (S2-04) - Form Input Booking Manual.
 *
 * Sumber kebenaran: docs/06 §2 (kontrak SourceAdapter), docs/06 §8 (adapter
 * manual), docs/01-development-plan.md tiket S2-04, docs/07-ui-spec.md.
 *
 * Berbeda dengan adapter CSV/email:
 * - Input datang dari form terstruktur (bukan file/email).
 - Confidence = "high" karena user mengetik sendiri (tidak ada parsing ambigu).
 * - estimated-vs-actual: form membedakan tanggal pemesanan pasti vs perkiraan.
 * - Channel selalu "MANUAL".
 *
 * Prinsip:
 * - Adapter MURNI: tidak ada I/O atau DB (lihat AGENTS.md aturan 3).
 * - Angka uang selalu string Decimal (bukan float) sesuai AGENTS.md aturan 4.
 * - Status awal form hanya PENDING/CONFIRMED. CANCELLED & NO_SHOW TIDAK bisa
 *   dibuat dari form awal (harus lewat reprocess event, lihat S2-03) supaya
 *   riwayat event tetap konsisten.
 */
import type {
  NormalizedBooking,
  ParsedBookingEvent,
  ParseResult,
  RawInput,
  SourceAdapter,
} from "../types";
import { safeValidateNormalizedBooking } from "../schema";

/** ID adapter; bagian dari kunci idempotency contentHash. */
export const MANUAL_ADAPTER_ID = "manual.form.v1" as const;

/**
 * Bentuk payload yang dikirim form "Tambah Booking" ke pipeline.
 * Semua field sudah berupa string (dari FormData) atau number.
 */
export interface ManualBookingInput {
  /** Kode referensi internal, mis. "MAN-2026-001". Wajib unik per organisasi. */
  externalId: string;
  listingId: string;
  status: "PENDING" | "CONFIRMED";
  checkIn: string;
  checkOut: string;
  currency: string;
  grossAmount: string;
  guestsCount?: number;
  /** Nama tamu / inisial saja (PII minimal, OD-06). */
  guestName?: string;
  /** Biaya pembatalan bila sudah diketahui. */
  cancellationFee?: string;
  /** Rate komisi 0..1 (mis. "0.15" untuk 15%). */
  commissionRate?: string;
  /** Nominal komisi bila sudah diketahui; bila kosong dihitung dari rate. */
  commissionAmount?: string;
  /** Tipe penagihan: OTA menagih, hotel menagih, atau belum diketahui. */
  collectType?: "CHANNEL_COLLECT" | "HOTEL_COLLECT" | "UNKNOWN";
  /** Tanggal pemesanan "YYYY-MM-DD" bila user mengisinya. */
  bookedOn?: string;
  /**true bila tanggal pemesanan tidak diketahui user (default: ya). */
  bookedAtIsApprox?: boolean;
  nights?: number;
}

/** Error khusus adapter manual supaya UI bisa menampilkan pesan jelas. */
export class ManualValidationError extends Error {
  readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]>) {
    super(message);
    this.name = "ManualValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/** Ubah payload form menjadi NormalizedBooking. Murni & deterministik. */
export function normalizeManualInput(input: ManualBookingInput): NormalizedBooking {
  const trimmedExternalId = input.externalId?.trim() ?? "";

  // Normalisasi amount: buang pemisah ribuan & simbol mata uang.
  // Titik ambigu diselesaikan dengan konvensi money.ts (docs/05 §1):
  // - >1 titik  -> semua titik adalah pemisah ribuan ("1.500.000").
  // - 1 titik, tepat 3 digit sesudahnya -> pemisah ribuan ("1.500").
  // - 1 titik, tepat 2 digit sesudahnya -> desimal ("1500.00").
  // - 1 titik, panjang lain -> diperlakukan sebagai ribuan (konservatif).
  const normalizeAmount = (raw: string | undefined): string | undefined => {
    if (raw === undefined) return undefined;
    const cleaned = raw.replace(/[^\d.]/g, "");
    if (cleaned === "") return undefined;
    const dotCount = (cleaned.match(/\./g) ?? []).length;
    if (dotCount === 0) return cleaned;
    if (dotCount > 1) return cleaned.replace(/\./g, "");
    const decimals = cleaned.slice(cleaned.lastIndexOf(".") + 1);
    return decimals.length === 2 ? cleaned : cleaned.replace(/\./g, "");
  };

  // commissionRate: user mengetik "15" atau "15%" atau "0.15" -> normalisasi 0..1.
  const normalizeRate = (raw: string | undefined): string | undefined => {
    if (raw === undefined) return undefined;
    const cleaned = raw.replace("%", "").trim();
    if (cleaned === "") return undefined;
    const num = Number(cleaned);
    // Bila bukan angka, kembalikan apa adanya agar validasi Zod yang menolak.
    if (Number.isNaN(num)) return cleaned;
    // > 1 dianggap persen (mis. "15" -> 0.15), <= 1 dianggap fraksi.
    const asFraction = num > 1 ? num / 100 : num;
    return String(asFraction);
  };

  const gross = normalizeAmount(input.grossAmount);
  const cancellationFee = normalizeAmount(input.cancellationFee);
  const commissionAmount = normalizeAmount(input.commissionAmount);
  const commissionRate = normalizeRate(input.commissionRate);

  // nights: default dihitung dari checkOut-checkIn bila kosong.
  const nights =
    input.nights !== undefined ? input.nights : computeNights(input.checkIn, input.checkOut);

  return {
    channel: "MANUAL",
    externalId: trimmedExternalId,
    status: input.status,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights,
    currency: input.currency.toUpperCase(),
    ...(gross !== undefined ? { grossAmount: gross } : {}),
    ...(cancellationFee !== undefined ? { cancellationFee } : {}),
    ...(commissionAmount !== undefined ? { commissionAmount } : {}),
    ...(commissionRate !== undefined ? { commissionRate } : {}),
    ...(input.guestsCount !== undefined ? { guestsCount: input.guestsCount } : {}),
    ...(input.guestName?.trim() ? { guestName: input.guestName.trim() } : {}),
    ...(input.collectType ? { collectType: input.collectType } : {}),
    ...(input.bookedOn && input.bookedAtIsApprox === false
      ? { bookedAt: new Date(`${input.bookedOn}T00:00:00+08:00`) }
      : {}),
    // Simpan form mentah sebagai rawPayload untuk audit & reprocess.
    rawPayload: {
      source: MANUAL_ADAPTER_ID,
      listingId: input.listingId,
      bookedOn: input.bookedOn ?? null,
      bookedAtIsApprox: input.bookedAtIsApprox ?? true,
      originalInput: input as unknown as Record<string, unknown>,
    },
  };
}

/** Hitung malam antara dua tanggal "YYYY-MM-DD" tanpa import lib (adapter murni). */
function computeNights(checkIn: string, checkOut: string): number | undefined {
  const re = /^(\d{4})-(\d{2})-(\d{2})$/;
  const m1 = re.exec(checkIn);
  const m2 = re.exec(checkOut);
  if (!m1 || !m2) return undefined;
  const d1 = Date.UTC(Number(m1[1]), Number(m1[2]) - 1, Number(m1[3]));
  const d2 = Date.UTC(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
  const diff = Math.round((d2 - d1) / 86_400_000);
  return diff > 0 ? diff : undefined;
}

/**
 * Adapter MANUAL. Menerima RawInput kind "manual".
 * Id = "manual.form.v1" sesuai konvensi penamaan adapter.
 */
export class ManualBookingAdapter implements SourceAdapter {
  readonly id = MANUAL_ADAPTER_ID;
  readonly channel = "MANUAL" as const;

  supports(input: RawInput): boolean {
    return input.kind === "manual";
  }

  parse(input: RawInput): ParseResult {
    if (input.kind !== "manual") {
      return {
        ok: false,
        errorCode: "UNSUPPORTED_FORMAT",
        message: `ManualBookingAdapter hanya mendukung RawInput jenis 'manual', menerima '${input.kind}'`,
      };
    }

    const payload = input.payload as Partial<ManualBookingInput> | null | undefined;
    if (!payload || typeof payload !== "object") {
      return {
        ok: false,
        errorCode: "MISSING_FIELD",
        message: "Payload manual kosong atau bukan objek.",
      };
    }

    const normalized = normalizeManualInput(payload as ManualBookingInput);
    const validated = safeValidateNormalizedBooking(normalized);

    if (!validated.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validated.error.issues) {
        const key = issue.path.join(".") || "_root";
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
      }
      return {
        ok: false,
        errorCode: "INVALID_VALUE",
        message: "Data booking manual tidak valid.",
        details: fieldErrors,
      };
    }

    // Event awal selalu CREATED: form tidak bisa membuat event CANCELLED/NO_SHOW.
    const event: ParsedBookingEvent = {
      eventType: "CREATED",
      occurredAt: normalized.bookedAt ?? new Date(),
      booking: validated.data as NormalizedBooking,
      confidence: "high",
      warnings: [],
    };

    return { ok: true, events: [event] };
  }
}
