/**
 * Filter global bilah atas (S4-01).
 *
 * Sumber kebenaran: parameter URL `propertyId`, `period`, `from`, `to`.
 * Setiap halaman membaca modul ini lalu memfilter datanya.
 *
 * Bandingkan dengan `src/lib/forms/booking-list-search-schema.ts`
 * (filter milik halaman Bookings: OTA, status, pencarian, paginasi).
 * `propertyId` dan rentang tanggal berada di sini (global) supaya
 * konsisten di seluruh aplikasi, bukan diduplikasi per halaman.
 *
 * Preset "bulan ini" / "tahun berjalan" diselesaikan dalam zona WITA agar
 * batas hari selalu sesuai kalender Bali. `today` diterima sebagai argumen
 * supaya parser deterministik: uji menyuntik tanggal dan tidak bergantung
 * jam dinding (bandingkan AGENTS.md aturan 3).
 */
import { endOfMonth, startOfMonth, subDays } from "@/lib/dates";
import type { DateRange, StayDate } from "@/lib/dates";

/** Kunci URL yang dimanipulasi filter global. */
export const GLOBAL_FILTER_KEYS = ["propertyId", "period", "from", "to"] as const;
export type GlobalFilterKey = (typeof GLOBAL_FILTER_KEYS)[number];

/** Preset periode yang dikenal. */
export const PERIOD_PRESETS = ["this_month", "last_month", "this_year", "custom"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

const PRESET_SET = new Set<string>(PERIOD_PRESETS);
const GLOBAL_KEY_SET = new Set<string>(GLOBAL_FILTER_KEYS);

/** Label Indonesia untuk dropdown periode (docs/07-ui-spec.md §2). */
export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  this_month: "Bulan ini",
  last_month: "Bulan lalu",
  this_year: "Tahun berjalan",
  custom: "Kustom",
};

/** Nilai yang direpresentasikan di URL; tidak butuh jam dinding. */
export interface GlobalFilterSelection {
  propertyId?: string;
  period: PeriodPreset;
  /** Dipakai hanya saat period = "custom". Batas bawah inklusif. */
  from?: StayDate;
  /** Dipakai hanya saat period = "custom". Batas atas inklusif. */
  to?: StayDate;
}

export interface GlobalFilter extends GlobalFilterSelection {
  /** Rentang hasil resolusi preset. Null saat custom tanpa from/to. */
  range: DateRange | null;
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** Ambil satu string dari searchParams (gaya Next: string | string[]). */
function pickString(
  raw: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = raw[key];
  if (v === undefined || v === null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  if (s === undefined || s === "") return undefined;
  return String(s).trim();
}

function pickDate(
  raw: Record<string, string | string[] | undefined>,
  key: string,
): StayDate | undefined {
  const s = pickString(raw, key);
  if (s === undefined || !isoDate.test(s)) return undefined;
  return s;
}

function pickPreset(raw: Record<string, string | string[] | undefined>): PeriodPreset {
  const s = pickString(raw, "period");
  if (s && PRESET_SET.has(s)) return s as PeriodPreset;
  return "this_month";
}

/**
 * Parse searchParams mentah menjadi nilai filter yang ter-resolve, TANPA
 * jam dinding. Dipakai Client Component (bilah filter, navbar) yang hanya
 * perlu tahu nilai yang sedang aktif.
 */
export function parseGlobalFilterSelection(
  raw: Record<string, string | string[] | undefined>,
): GlobalFilterSelection {
  const propertyId = pickString(raw, "propertyId");
  const period = pickPreset(raw);
  const from = pickDate(raw, "from");
  const to = pickDate(raw, "to");
  const out: GlobalFilterSelection = { period };
  if (propertyId !== undefined) out.propertyId = propertyId;
  if (from !== undefined) out.from = from;
  if (to !== undefined) out.to = to;
  return out;
}

/**
 * Parse searchParams + resolusi rentang tanggal. `today` disuntik supaya
 * hasil deterministik dan konsisten dengan zona WITA di server.
 */
export function parseGlobalFilter(
  raw: Record<string, string | string[] | undefined>,
  today: StayDate,
): GlobalFilter {
  const sel = parseGlobalFilterSelection(raw);
  return { ...sel, range: resolvePeriodRange(sel.period, today, sel.from, sel.to) };
}

function startOfPrevMonth(today: StayDate): StayDate {
  // Mundur satu hari dari awal bulan = hari terakhir bulan sebelumnya.
  return startOfMonth(subDays(startOfMonth(today), 1));
}

/**
 * Resolusi preset ke rentang tanggal inklusif.
 * "custom" butuh from & to; bila salah satu hilang hasilnya null, artinya
 * halaman tidak membatasi tanggal. from > to ditukar agar URL yang keliru
 * tetap menghasilkan rentang yang masuk akal.
 */
export function resolvePeriodRange(
  period: PeriodPreset,
  today: StayDate,
  from?: StayDate,
  to?: StayDate,
): DateRange | null {
  switch (period) {
    case "this_month": {
      const start = startOfMonth(today);
      const end = endOfMonth(today);
      return { start, end };
    }
    case "last_month": {
      const start = startOfPrevMonth(today);
      return { start, end: endOfMonth(start) };
    }
    case "this_year":
      return {
        start: `${today.slice(0, 4)}-01-01` as StayDate,
        end: `${today.slice(0, 4)}-12-31` as StayDate,
      };
    case "custom":
      if (!from || !to) return null;
      if (from > to) return { start: to, end: from };
      return { start: from, end: to };
    default:
      return null;
  }
}

/**
 * Query string dari filter global saja. `from`/`to` hanya disertakan saat
 * period = "custom" supaya URL tidak memuat parameter sia-sia.
 *
 * Hanya butuh nilai yang tampil di URL, bukan `range` hasil resolusi -
 * itu sebabnya tipe masukannya `GlobalFilterSelection`.
 */
export function globalFilterQueryString(f: GlobalFilterSelection): string {
  const params = globalParams(f);
  return serializeParams(params);
}

/** Bentuk `Record<string, string>` dari filter global (tanpa tanda "?"). */
export function globalParams(f: GlobalFilterSelection): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.propertyId) out.propertyId = f.propertyId;
  out.period = f.period;
  if (f.period === "custom") {
    if (f.from) out.from = f.from;
    if (f.to) out.to = f.to;
  }
  return out;
}

/**
 * Gabungkan filter global baru dengan parameter lokal halaman yang sedang
 * aktif (mis. `channel`, `status`, `search`, `page`, `sort` di /bookings).
 *
 * Nilai string kosong berarti HAPUS kunci tersebut - itulah cara dropdown
 * "Semua properti" membersihkan filter.
 */
export function mergeKeepingNonGlobal(
  current: Record<string, string | string[] | undefined>,
  updates: Partial<Record<GlobalFilterKey, string>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) {
    if (GLOBAL_KEY_SET.has(k)) continue;
    const s = Array.isArray(v) ? v[0] : v;
    if (s === undefined || s === "") continue;
    out[k] = s;
  }
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined || v === "") delete out[k];
    else out[k] = v;
  }
  if (out.period !== "custom") {
    delete out.from;
    delete out.to;
  }
  return out;
}

/** Query string generik; awali "?" dan kosongkan bila tidak ada parameter. */
export function serializeParams(params: Record<string, string>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    usp.set(k, v);
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}
