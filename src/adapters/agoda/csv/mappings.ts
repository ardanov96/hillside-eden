/**
 * Pemetaan kolom & nilai untuk CSV reservasi Agoda (YCS Extranet & Partner Portal).
 *
 * Ekspor Agoda bisa memakai kombinasi kolom yang berbeda-beda. Pada Agoda
 * Partner Portal pengguna bebas memilih kolom & filter apa saja saat mengekspor
 * "Reservasi", sehingga nama kolom (bukan posisinya) adalah satu-satunya
 * penanda yang stabil.
 *
 * Karena itu modul ini memetakan header kolom ke field logis lewat alias.
 * Aturan penting:
 * - Satu kolom hanya boleh dipakai untuk SATU field (first-match wins). Tanpa
 *   aturan ini "Customer_Nationality" bisa ikut terpetakan sebagai nama tamu.
 * - Pencocokan bertingkat: exact -> prefix -> contains, dengan alias yang lebih
 *   spesifik diperiksa lebih dulu.
 * - Murni & deterministik (AGENTS.md aturan 3): tanpa I/O, tanpa LLM, tanpa
 *   jaringan, tanpa jam dinding.
 */
import type { BookingStatus, CollectType, EventType } from "@/adapters/types";
import type { DateFormatPattern } from "@/adapters/csv-generic/profile";

/** Field logis yang bisa dipetakan dari kolom ekspor Agoda. */
export type AgodaField =
  | "bookingId"
  | "checkIn"
  | "checkOut"
  | "bookedDate"
  | "status"
  | "paymentModel"
  | "currency"
  | "grossAmount"
  | "commission"
  | "sellInclusive"
  | "roomType"
  | "ratePlan"
  | "propertyName"
  | "guestName"
  | "nationality"
  | "adults"
  | "children"
  | "nights"
  | "acknowledged";

/**
 * Alias header per field (sudah ternormalisasi: huruf kecil, tanpa karakter
 * non-alfanumerik). Alias paling spesifik ditulis paling depan.
 */
export const AGODA_COLUMN_ALIASES: Record<AgodaField, readonly string[]> = {
  bookingId: [
    "bookingidexternalreferenceid",
    "bookingid",
    "bookingreferenceid",
    "bookingreference",
    "referenceid",
    "idreservasi",
    "idpesanan",
  ],
  checkIn: [
    "checkindate",
    "checkin",
    "staydatefrom",
    "arrivaldate",
    "arrival",
    "tanggalcheckin",
    "tanggalmasuk",
    "checkinday",
  ],
  checkOut: [
    "checkoutdate",
    "checkout",
    "staydateto",
    "departuredate",
    "departure",
    "tanggalcheckout",
    "tanggalkeluar",
    "checkoutday",
  ],
  bookedDate: [
    "bookeddate",
    "bookingdate",
    "tanggalbooking",
    "tanggalpesanan",
    "reservationdate",
    "createdat",
    "bookedat",
  ],
  status: ["bookingstatus", "statusreservasi", "statuspemesanan", "reservationstatus", "status"],
  paymentModel: ["paymentmodel", "modelpembayaran", "payment", "pembayaran"],
  currency: ["currency", "matauang", "currencycode"],
  grossAmount: [
    "totalinclusiverate",
    "totalamount",
    "totalrate",
    "inclusiverate",
    "grandtotal",
    "totalprice",
    "total",
    "amount",
  ],
  commission: ["commission", "komisi", "commissionamount"],
  sellInclusive: ["referencesellinclusive", "sellinclusive", "referencesell"],
  roomType: ["roomtype", "roomtypename", "tipkamar", "namakamar", "roomname", "room"],
  ratePlan: ["rateplan", "rateplanname", "namarateplan"],
  propertyName: ["propertyname", "namapropeti", "propertiname", "property"],
  guestName: [
    "customername",
    "guestname",
    "namatamu",
    "leadguestname",
    "namapesan",
    "primaryguestname",
  ],
  nationality: [
    "customernationality",
    "guestnationality",
    "nationality",
    "nationalitas",
    "customercountry",
  ],
  adults: ["noofadult", "noofadults", "numberofadults", "adults", "adult", "jumlahdewasa"],
  children: ["noofchildren", "noofchild", "numberofchildren", "children", "child", "jumlahanak"],
  nights: ["noofnight", "noofnights", "numberofnights", "nights", "night", "malam", "jumlahmalam"],
  acknowledged: ["acknowledged", "isacknowledged", "acknowledgement"],
};

/**
 * Urutan prioritas pemetaan. Field yang lebih dulu diproses merebut kolom
 * lebih dulu, sehingga alias generik ("total", "room", "payment") tidak
 * merebut kolom milik field yang lebih spesifik.
 */
export const AGODA_FIELD_PRIORITY: readonly AgodaField[] = [
  "bookingId",
  "checkIn",
  "checkOut",
  "bookedDate",
  "status",
  "paymentModel",
  "currency",
  "grossAmount",
  "commission",
  "sellInclusive",
  "roomType",
  "ratePlan",
  "propertyName",
  "guestName",
  "nationality",
  "adults",
  "children",
  "nights",
  "acknowledged",
];

/**
 * Header khas Agoda. Dipakai untuk memastikan file yang diklaim adapter Agoda
 * memang berasal dari Agoda (menghindari tabrakan dengan adapter OTA lain
 * yang memakai header generik seperti "Booking ID" / "Check-in Date").
 */
export const AGODA_MARKER_ALIASES: readonly string[] = [
  "bookingidexternalreferenceid",
  "totalinclusiverate",
  "referencesellinclusive",
  "paymentmodel",
  "customernationality",
  "staydatefrom",
  "staydateto",
  "noofnight",
  "noofadult",
  "noofchildren",
  "acknowledged",
  "rateplan",
  "promotiontype",
  "cancellationpolicycode",
  "specialrequest",
  "roomtypename",
];

/** Normalisasi nama header: huruf kecil + buang karakter non-alfanumerik. */
export function normalizeHeader(value: string | undefined | null): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Normalisasi nilai teks (status, model bayar, kebangsaan). */
export function normalizeValue(value: string | undefined | null): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Cari indeks kolom yang cocok dengan salah satu alias.
 *
 * Pencocokan bertingkat: exact -> prefix -> contains. Kolom yang sudah
 * dipakai field lain (`used`) tidak akan diambil lagi.
 */
export function findAgodaColumn(
  headers: readonly string[],
  aliases: readonly string[],
  used: ReadonlySet<number>,
): number {
  for (const alias of aliases) {
    for (let i = 0; i < headers.length; i++) {
      if (!used.has(i) && headers[i] === alias) return i;
    }
  }
  for (const alias of aliases) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i] ?? "";
      if (!used.has(i) && h.length > alias.length && h.startsWith(alias)) return i;
    }
  }
  for (const alias of aliases) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i] ?? "";
      if (!used.has(i) && h.includes(alias)) return i;
    }
  }
  return -1;
}

/** Petakan seluruh kolom yang tersedia ke field logis Agoda. */
export function mapAgodaColumns(headers: readonly string[]): Record<AgodaField, number> {
  const used = new Set<number>();
  const map = {} as Record<AgodaField, number>;
  for (const field of AGODA_FIELD_PRIORITY) {
    const index = findAgodaColumn(headers, AGODA_COLUMN_ALIASES[field], used);
    map[field] = index;
    if (index >= 0) used.add(index);
  }
  return map;
}

/** Apakah header memuat penanda khas Agoda? */
export function hasAgodaMarker(headers: readonly string[]): boolean {
  return headers.some((h) => AGODA_MARKER_ALIASES.includes(h));
}

/**
 * Deteksi baris header: baris pertama yang memuat kolom ID reservasi Agoda
 * dan minimal satu kolom lagi yang dikenal (tanggal/status/tamu/kamar).
 */
export function detectAgodaHeaderRow(
  rows: readonly string[][],
): { rowIndex: number; headers: string[]; original: string[] } | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const first = (row[0] ?? "").trim();
    if (first.startsWith("#")) continue;
    if (row.every((c) => (c ?? "").trim() === "")) continue;

    const original = row.map((c) => (c ?? "").trim());
    const headers = original.map((c) => normalizeHeader(c));
    const hasBookingId = findAgodaColumn(headers, AGODA_COLUMN_ALIASES.bookingId, new Set()) >= 0;
    if (!hasBookingId) continue;

    const known = (["checkIn", "checkOut", "status", "guestName", "roomType"] as const).some(
      (field) => findAgodaColumn(headers, AGODA_COLUMN_ALIASES[field], new Set()) >= 0,
    );
    if (!known) continue;

    return { rowIndex: i, headers, original };
  }
  return null;
}

/** Hasil pemetaan status reservasi Agoda. */
export interface AgodaStatusMapping {
  status: BookingStatus;
  eventType: EventType;
  /** Peringatan bila status diasumsikan (kolom tidak ada / nilai tak dikenal). */
  warning?: string;
}

/**
 * Petakan status reservasi Agoda (Indonesia & Inggris) ke BookingStatus.
 *
 * Nilai resmi Agoda: "Menunggu" (pending), "Dikonfirmasi" (confirmed),
 * "Dibatalkan" (cancelled), "Selesai" (completed), "Tidak datang" (no-show).
 */
export function mapAgodaStatus(raw: string | undefined | null): AgodaStatusMapping {
  const s = normalizeValue(raw);
  if (!s) {
    return {
      status: "CONFIRMED",
      eventType: "CREATED",
      warning: "Status reservasi tidak ditemukan; diasumsikan Dikonfirmasi.",
    };
  }
  if (/(tidak\s?datang|tidakhadir|no[\s_-]?show|noshow|did not arrive|not arrive)/.test(s)) {
    return { status: "NO_SHOW", eventType: "NO_SHOW" };
  }
  if (/(dibatalkan|batal|cancel)/.test(s)) {
    return { status: "CANCELLED", eventType: "CANCELLED" };
  }
  if (/(kedaluwarsa|expired)/.test(s)) {
    return {
      status: "CANCELLED",
      eventType: "CANCELLED",
      warning: "Status kedaluwarsa dipetakan sebagai Pembatalan.",
    };
  }
  if (/(menunggu|pending|wait|on hold|hold)/.test(s)) {
    return { status: "PENDING", eventType: "CREATED" };
  }
  if (/(dikonfirmasi|confirmed|selesai|completed|complete|check[\s_-]?in|berhasil)/.test(s)) {
    return { status: "CONFIRMED", eventType: "CREATED" };
  }
  return {
    status: "CONFIRMED",
    eventType: "CREATED",
    warning: `Status reservasi "${raw?.trim()}" tidak dikenali; diasumsikan Dikonfirmasi.`,
  };
}

/** Hasil pemetaan model pembayaran Agoda. */
export interface AgodaCollectTypeMapping {
  collectType: CollectType;
  warning?: string;
}

/**
 * Petakan model pembayaran Agoda ke CollectType.
 *
 * "Bayar ke Agoda" / "Agoda Collect" -> CHANNEL_COLLECT
 * "Bayar ke Properti" / "Pay at Property" -> HOTEL_COLLECT
 */
export function mapAgodaCollectType(raw: string | undefined | null): AgodaCollectTypeMapping {
  const s = normalizeValue(raw);
  if (!s) {
    return {
      collectType: "CHANNEL_COLLECT",
      warning: "Model pembayaran tidak ditemukan; diasumsikan Agoda Collect.",
    };
  }
  if (/(bayar ke agoda|agoda collect|channel collect|agoda pay|virtual account)/.test(s)) {
    return { collectType: "CHANNEL_COLLECT" };
  }
  if (
    /(bayar ke properti|bayar di properti|pay at property|hotel collect|property collect|collect at property|pay at hotel|bayar di hotel|bayar di klien)/.test(
      s,
    )
  ) {
    return { collectType: "HOTEL_COLLECT" };
  }
  return {
    collectType: "CHANNEL_COLLECT",
    warning: `Model pembayaran "${raw?.trim()}" tidak dikenali; diasumsikan Agoda Collect.`,
  };
}

/** Peta kebangsaan → ISO2 (nama Indonesia & Inggris). */
const NATIONALITY_TO_ISO2: Record<string, string> = {
  indonesia: "ID",
  malesia: "MY",
  malaysia: "MY",
  brunei: "BN",
  singapura: "SG",
  singapore: "SG",
  thailand: "TH",
  tailand: "TH",
  vietnam: "VN",
  kamboja: "KH",
  cambodia: "KH",
  laos: "LA",
  myanmar: "MM",
  burma: "MM",
  india: "IN",
  filipina: "PH",
  philippines: "PH",
  jepang: "JP",
  japan: "JP",
  korea: "KR",
  korealingselatan: "KR",
  southkorea: "KR",
  hongkong: "HK",
  taiwan: "TW",
  cina: "CN",
  china: "CN",
  australia: "AU",
  selandiabaru: "NZ",
  newzealand: "NZ",
  amerikaserikat: "US",
  unitedstates: "US",
  unitedstatesofamerica: "US",
  usa: "US",
  amerika: "US",
  inggris: "GB",
  unitedkingdom: "GB",
  uk: "GB",
  ireland: "IE",
  irlandia: "IE",
  jerman: "DE",
  germany: "DE",
  prancis: "FR",
  france: "FR",
  spanyol: "ES",
  spain: "ES",
  portugal: "PT",
  italia: "IT",
  italy: "IT",
  swiss: "CH",
  switzerland: "CH",
  austria: "AT",
  belanda: "NL",
  netherlands: "NL",
  belgia: "BE",
  denmark: "DK",
  sweden: "SE",
  norway: "NO",
  finland: "FI",
  polandia: "PL",
  poland: "PL",
  rusia: "RU",
  russia: "RU",
  ukraina: "UA",
  mesir: "EG",
  egypt: "EG",
  afrikaselatan: "ZA",
  southafrica: "ZA",
  saudi: "SA",
  saudiarabia: "SA",
  uniemiratarab: "AE",
  unitedarabemirates: "AE",
  qatar: "QA",
  kuwait: "KW",
  bahrain: "BH",
  canada: "CA",
  meksiko: "MX",
  mexico: "MX",
  brasil: "BR",
  brazil: "BR",
  argentina: "AR",
  chile: "CL",
  colombia: "CO",
  peru: "PE",
  turki: "TR",
  turkey: "TR",
  selangor: "MY",
  jawa: "ID",
  bali: "ID",
};

/**
 * Petakan kebangsaan tamu ke kode negara ISO2. Mengembalikan undefined bila
 * tidak dikenali (tidak ditebak, sesuai aturan "jangan mengarang data").
 */
export function mapAgodaCountryCode(raw: string | undefined | null): string | undefined {
  const s = normalizeValue(raw);
  if (!s) return undefined;
  if (/^[a-z]{2}$/.test(s)) return s.toUpperCase();
  return NATIONALITY_TO_ISO2[normalizeHeader(s)];
}

/**
 * Inferensi format tanggal (MM/DD/YYYY vs DD/MM/YYYY) dari data yang ada.
 *
 * Ekspor Agoda memakai format US (MM/DD/YYYY) pada Partner Portal, sementara
 * YCS bisa memakai format lokal. Daripada menebak per kolom, format dideteksi
 * dari data: bila ada angka > 12 pada posisi pertama -> DD/MM, pada posisi
 * kedua -> MM/DD. Bila keduanya <= 12 (ambigu) dipakai aturan AUTO bawaan.
 */
export function inferAgodaDateOrder(values: readonly string[]): DateFormatPattern {
  let sawDayFirst = false;
  let sawMonthFirst = false;
  for (const value of values) {
    const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec((value ?? "").trim());
    if (!m) continue;
    const first = Number(m[1]);
    const second = Number(m[2]);
    if (first > 12) sawDayFirst = true;
    else if (second > 12) sawMonthFirst = true;
  }
  if (sawDayFirst && !sawMonthFirst) return "DD/MM/YYYY";
  if (sawMonthFirst && !sawDayFirst) return "MM/DD/YYYY";
  return "AUTO";
}
