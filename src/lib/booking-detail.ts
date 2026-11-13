/**
 * Helper murni untuk halaman detail booking (S2-07.3).
 *
 * Dipisah dari komponen supaya bisa diuji tanpa React/Next dan dipakai
 * bersama oleh server component maupun laporan.
 *
 * Sumber kebenaran tampilan: docs/07-ui-spec.md §3.2 (panel detail: ringkasan,
 * alokasi unit, komisi estimasi/aktual, riwayat perubahan `booking_event`,
 * tautan ke item impor asal).
 */

/** Label Bahasa Indonesia untuk tiap jenis event booking. */
export const EVENT_TYPE_LABEL: Record<string, string> = {
  CREATED: "Booking dibuat",
  MODIFIED: "Data booking diubah",
  CANCELLED: "Booking dibatalkan",
  NO_SHOW: "Tamu tidak hadir",
  PAYOUT_LINKED: "Payout ditautkan",
  MANUAL_EDIT: "Diubah manual",
};

/** Label Bahasa Indonesia untuk field yang bisa muncul pada diff. */
export const DIFF_FIELD_LABEL: Record<string, string> = {
  status: "Status",
  checkIn: "Check-in",
  checkOut: "Check-out",
  nights: "Jumlah malam",
  guestsCount: "Jumlah tamu",
  currency: "Mata uang",
  grossAmount: "Nilai booking (gross)",
  taxesCollected: "Pajak dipungut",
  cancellationFee: "Biaya pembatalan",
  commissionAmount: "Komisi OTA (nominal)",
  commissionRate: "Komisi OTA (rate)",
  collectType: "Model pembayaran",
  fxRateToBase: "Kurs ke mata uang dasar",
};

export interface DiffChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

/** Format satu nilai diff menjadi teks yang bisa ditampilkan. */
export function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value.trim() === "" ? "-" : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value) ?? "-";
  } catch {
    return String(value);
  }
}

/**
 * Ringkas diff booking (`{ field: { from, to } }`) menjadi daftar baris
 * yang siap ditampilkan. Nilai yang tidak berbentuk objek dilewati.
 */
export function summarizeDiff(diff: unknown): DiffChange[] {
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) return [];
  const out: DiffChange[] = [];
  for (const [field, pair] of Object.entries(diff as Record<string, unknown>)) {
    if (!pair || typeof pair !== "object" || Array.isArray(pair)) continue;
    const { from, to } = pair as { from?: unknown; to?: unknown };
    out.push({
      field,
      label: DIFF_FIELD_LABEL[field] ?? field,
      from: formatDiffValue(from),
      to: formatDiffValue(to),
    });
  }
  return out;
}

/** Label Bahasa Indonesia untuk status item impor. */
export const IMPORT_ITEM_STATUS_LABEL: Record<string, string> = {
  PARSED: "Berhasil diparse",
  DUPLICATE: "Duplikat dilewati",
  FAILED: "Gagal diproses",
  NEEDS_REVIEW: "Perlu ditinjau",
};

/** Label Bahasa Indonesia untuk jenis sumber impor. */
export const IMPORT_KIND_LABEL: Record<string, string> = {
  EMAIL: "Email",
  CSV: "Berkas CSV",
  ICAL: "Kalender iCal",
  MANUAL: "Input manual",
};
