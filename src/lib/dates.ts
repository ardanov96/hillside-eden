/**
 * Modul dates: primitif tanggal untuk aplikasi.
 * - StayDate: "YYYY-MM-DD" (tanpa zona, tipe date di DB) per docs/05 §1.
 * - WITA: "Asia/Makassar" (UTC+8, tanpa DST) per docs/05 §1.
 * - Interval: [start, end) inklusif-eksklusif; nights = end - start.
 */

export const WITA = "Asia/Makassar" as const;

export type StayDate = string;

export interface DateRange {
  start: StayDate;
  end: StayDate;
}

const STAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isStayDate(value: string): boolean {
  if (!STAY_RE.test(value)) return false;
  const parts = value.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y === undefined || m === undefined || d === undefined) return false;
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export function assertStayDate(value: string): StayDate {
  if (!isStayDate(value)) throw new Error(`Invalid stay date: ${value} (expected YYYY-MM-DD)`);
  return value;
}

const WITA_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: WITA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const WITA_DATETIME_FMT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: WITA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function toStayDate(d: Date): StayDate {
  return WITA_DATE_FMT.format(d);
}

export function fromStayDate(value: StayDate): Date {
  assertStayDate(value);
  const parts = value.split("-").map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  return new Date(Date.UTC(y, m - 1, d));
}

export function todayInWITA(): StayDate {
  return toStayDate(new Date());
}

export function nowInWITA(): Date {
  return new Date();
}

export function addDays(value: StayDate, n: number): StayDate {
  if (!Number.isInteger(n)) throw new Error(`addDays: n must be integer, got ${n}`);
  const d = fromStayDate(value);
  d.setUTCDate(d.getUTCDate() + n);
  return toStayDate(d);
}
export function subDays(value: StayDate, n: number): StayDate {
  return addDays(value, -n);
}

export function daysBetween(start: StayDate, end: StayDate): number {
  return Math.round((fromStayDate(end).getTime() - fromStayDate(start).getTime()) / 86_400_000);
}

export function nightsBetween(checkIn: StayDate, checkOut: StayDate): number {
  const n = daysBetween(checkIn, checkOut);
  return n > 0 ? n : 0;
}

export function compareStayDate(a: StayDate, b: StayDate): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start < b.end && b.start < a.end;
}

export function isInRange(value: StayDate, r: DateRange): boolean {
  return value >= r.start && value < r.end;
}

export function eachDayInRange(r: DateRange): StayDate[] {
  if (r.end <= r.start) return [];
  const out: StayDate[] = [];
  let cur: StayDate = r.start;
  while (cur < r.end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/**
 * Malam dari interval [checkIn, checkOut) yang jatuh dalam [periodStart, periodEnd).
 * docs/05 §2: hanya malam yang jatuh dalam P dihitung ke P.
 * Golden case: checkIn 2026-10-30, checkOut 2026-11-03, period 2026-10-01..2026-10-31 -> 2 malam.
 */
export function nightsInPeriod(
  checkIn: StayDate,
  checkOut: StayDate,
  periodStart: StayDate,
  periodEnd: StayDate,
): StayDate[] {
  const start: StayDate = checkIn > periodStart ? checkIn : periodStart;
  const end: StayDate = checkOut < periodEnd ? checkOut : periodEnd;
  return eachDayInRange({ start, end });
}

export function monthOf(value: StayDate): string {
  assertStayDate(value);
  return value.slice(0, 7);
}

export function startOfMonth(value: StayDate): StayDate {
  assertStayDate(value);
  return `${value.slice(0, 7)}-01`;
}

export function endOfMonth(value: StayDate): StayDate {
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const yyyy = String(y);
  const mm = String(m).padStart(2, "0");
  const dd = String(last).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Format tanggal id-ID. Contoh dengan weekday: "Sel, 25 Okt 2026". */
export function formatStayDateId(value: StayDate, options: { withWeekday?: boolean } = {}): string {
  const d = fromStayDate(value);
  if (options.withWeekday) {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatMonthId(value: StayDate): string {
  const d = fromStayDate(value);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatTimestampWITA(d: Date): string {
  const base = WITA_DATETIME_FMT.format(d).replace("T", " ");
  return `${base} WITA`;
}

/** Parse tanggal id-ID: ISO, "25/10/2026", "25-10-2026", "25 Oktober 2026", "25 Okt 2026". */
export function parseStayDate(input: string): StayDate {
  const value: string = input.trim();
  if (isStayDate(value)) return value;
  const slashMatch: RegExpMatchArray | null = value.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
  );
  if (slashMatch) {
    const dd = slashMatch[1]!.padStart(2, "0");
    const mm = slashMatch[2]!.padStart(2, "0");
    const yyyy = slashMatch[3]!;
    return assertStayDate(`${yyyy}-${mm}-${dd}`);
  }
  const months: readonly string[] = [
    "januari",
    "februari",
    "maret",
    "april",
    "mei",
    "juni",
    "juli",
    "agustus",
    "september",
    "oktober",
    "november",
    "desember",
  ];
  const lower: string = value.toLowerCase();
  const named: RegExpMatchArray | null = lower.match(/^(\d{1,2})\s+([a-z.]+)\s+(\d{4})$/);
  if (named) {
    const dd: string = named[1]!.padStart(2, "0");
    const monthName: string = named[2]!.replace(/\./g, "");
    const idx: number = months.findIndex(
      (m) => m === monthName || m.startsWith(monthName) || monthName.startsWith(m.slice(0, 3)),
    );
    if (idx >= 0) {
      const yyyy = named[3]!;
      const mm = String(idx + 1).padStart(2, "0");
      return assertStayDate(`${yyyy}-${mm}-${dd}`);
    }
  }
  const fallback: Date = new Date(value);
  if (!Number.isNaN(fallback.getTime())) return toStayDate(fallback);
  throw new Error(`Unparseable date: ${input}`);
}
