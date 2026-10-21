/**
 * Pemetaan badge untuk UI (S2-07.4).
 *
 * Sumber kebenaran:
 * - docs/07-ui-spec.md §1 (copy deck): teks baku badge.
 * - docs/07-ui-spec.md §4 (pola komponen): "Badge status data: Estimasi /
 *   Aktual / Belum lengkap".
 * - docs/07-ui-spec.md §6 (a11y): badge tidak hanya mengandalkan warna
 *   (selalu sertakan teks + ikon).
 *
 * Modul ini murni (tidak import React/Next) agar bisa diuji di node-env dan
 * dipakai bersama antara server component, client component, dan laporan.
 *
 * Jangan pernah menulis ulang teks badge di komponen; selalu lewat mapper
 * ini supaya satu sumber untuk seluruh UI.
 */
import type { BookingStatus, CollectType, CommissionBasis } from "@prisma/client";

// ----------------------------------------------------------------------------
// Tone: kelas Tailwind untuk 5 keluarga warna baku.
// Dipakai bersama: kelas bg/text/border memakai prefix yang sama.
// ----------------------------------------------------------------------------
export type BadgeTone = "positive" | "caution" | "danger" | "muted" | "info";

/**
 * Kelas Tailwind lengkap untuk satu tone (light + dark).
 * Komponen tinggal spread; tidak pernah menulis kelas warna secara langsung.
 */
export const BADGE_TONE_CLASS: Record<
  BadgeTone,
  { bg: string; text: string; border: string; dot: string }
> = {
  positive: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "text-emerald-500",
  },
  caution: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dot: "text-amber-500",
  },
  danger: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "text-red-500",
  },
  muted: {
    bg: "bg-zinc-100",
    text: "text-zinc-700",
    border: "border-zinc-200",
    dot: "text-zinc-500",
  },
  info: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "text-sky-500",
  },
};

// ----------------------------------------------------------------------------
// Status booking (PENDING / CONFIRMED / CANCELLED / NO_SHOW).
// Teks mengikuti docs/07-ui-spec.md §1.
// ----------------------------------------------------------------------------
export interface BookingStatusBadge {
  label: string;
  tone: BadgeTone;
  /** Deskripsi panjang untuk tooltip / aria-label jika diperlukan. */
  description: string;
}

export const BOOKING_STATUS_BADGE: Record<BookingStatus, BookingStatusBadge> = {
  PENDING: {
    label: "Menunggu",
    tone: "caution",
    description: "Booking tercatat, menunggu konfirmasi OTA.",
  },
  CONFIRMED: {
    label: "Dikonfirmasi",
    tone: "positive",
    description: "Booking dikonfirmasi oleh OTA atau manual.",
  },
  CANCELLED: {
    label: "Dibatalkan",
    tone: "danger",
    description: "Booking dibatalkan (lihat riwayat perubahan).",
  },
  NO_SHOW: {
    label: "Tidak hadir",
    tone: "muted",
    description: "Tamu tidak datang pada hari check-in.",
  },
};

// ----------------------------------------------------------------------------
// Status data komisi: Aktual / Estimasi / Belum lengkap.
// docs/07-ui-spec.md §4: "Badge status data: Estimasi / Aktual / Belum lengkap".
// ----------------------------------------------------------------------------
export type DataStatusKind = "AKTUAL" | "ESTIMASI" | "BELUM_LENGKAP";

export interface DataStatusBadge {
  kind: DataStatusKind;
  label: string;
  tone: BadgeTone;
  description: string;
}

/** Konstanta siap-pakai untuk badge statis. */
export const DATA_STATUS_BADGE: Record<DataStatusKind, DataStatusBadge> = {
  AKTUAL: {
    kind: "AKTUAL",
    label: "Aktual",
    tone: "positive",
    description: "Komisi dari angka nominal yang dilaporkan OTA.",
  },
  ESTIMASI: {
    kind: "ESTIMASI",
    label: "Estimasi",
    tone: "caution",
    description: "Komisi dihitung dari rate; menunggu laporan payout.",
  },
  BELUM_LENGKAP: {
    kind: "BELUM_LENGKAP",
    label: "Belum lengkap",
    tone: "muted",
    description: "Belum ada rate maupun nominal komisi.",
  },
};

/**
 * Turunkan status komisi dari baris booking.
 *
 * Aturan (ADR-004: estimasi vs aktual harus dibedakan):
 * - commissionAmount ada (nominal dari OTA) -> AKTUAL.
 * - commissionAmount null, commissionRate ada -> ESTIMASI (placeholder kasar;
 *   di S7 akan diganti nilai payout aktual).
 * - keduanya null/undefined -> BELUM_LENGKAP.
 *
 * Parameter `commissionBasis` cuma dipakai sebagai override bila adapter
 * sengaja menulis MANUAL (mis. komisi diinput manual lewat form).
 */
export function resolveDataStatus(input: {
  commissionAmount?: unknown;
  commissionRate?: unknown;
  commissionBasis?: CommissionBasis | null;
}): DataStatusBadge {
  const amount = hasValue(input.commissionAmount);
  const rate = hasValue(input.commissionRate);
  // MANUAL dianggap "Aktual" karena user sudah memberi nilai final.
  if (input.commissionBasis === "MANUAL" && (amount || rate)) {
    return DATA_STATUS_BADGE.AKTUAL;
  }
  if (amount) return DATA_STATUS_BADGE.AKTUAL;
  if (rate) return DATA_STATUS_BADGE.ESTIMASI;
  return DATA_STATUS_BADGE.BELUM_LENGKAP;
}

function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  // Decimal-ish: serahkan ke caller untuk konversi.
  return true;
}

// ----------------------------------------------------------------------------
// Collect type: siapa menagih tamu.
// docs/07-ui-spec.md §1: Channel collect / Hotel collect / Belum diketahui.
// ----------------------------------------------------------------------------
export interface CollectTypeBadge {
  label: string;
  tone: BadgeTone;
  description: string;
}

export const COLLECT_TYPE_BADGE: Record<CollectType, CollectTypeBadge> = {
  CHANNEL_COLLECT: {
    label: "Ditagih OTA",
    tone: "info",
    description: "Tamu membayar ke OTA; hotel menerima net via payout.",
  },
  HOTEL_COLLECT: {
    label: "Ditagih hotel",
    tone: "positive",
    description: "Hotel menagih tamu langsung; komisi terutang ke OTA.",
  },
  UNKNOWN: {
    label: "Belum diketahui",
    tone: "muted",
    description: "Model pembayaran belum terbaca dari sumber.",
  },
};
