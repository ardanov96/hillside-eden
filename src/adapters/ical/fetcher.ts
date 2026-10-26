/**
 * Layanan penarik feed iCal aman dari SSRF dan sinkronisasi ke CalendarBlock.
 * Tiket: S5-04.
 */
import type { PrismaClient } from "@prisma/client";
import { validateSsrfSafeUrl } from "./ssrf";
import { parseIcal, type ParsedCalendarEvent } from "./parser";
import { fromStayDate } from "@/lib/dates";

export interface FetchIcalOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

export interface SyncIcalResult {
  listingId: string;
  totalParsed: number;
  upsertedCount: number;
  errors: string[];
}

/**
 * Mengambil dan mem-parsing feed iCal dari URL eksternal dengan proteksi SSRF.
 */
export async function fetchAndParseIcal(
  url: string,
  options: FetchIcalOptions = {},
): Promise<{ events: ParsedCalendarEvent[]; rawContent: string }> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024; // 5 MB max

  // 1. Validasi SSRF
  const { validUrl } = await validateSsrfSafeUrl(url);

  // 2. Fetch dengan timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(validUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "HillsideEden-CalendarSync/1.0 (+https://hillsideeden.com)",
        Accept: "text/calendar, text/plain;q=0.9, */*;q=0.8",
      },
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === "AbortError") {
      throw new Error(`Permintaan iCal timeout setelah ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(
      `Gagal mengambil iCal (HTTP ${response.status} ${response.statusText}): ${url}`,
    );
  }

  const rawContent = await response.text();
  if (rawContent.length > maxBytes) {
    throw new Error(`Ukuran respon iCal melebihi batas ${maxBytes} byte: ${url}`);
  }

  // 3. Parse konten iCalendar
  const parseRes = parseIcal(rawContent);
  if (!parseRes.ok && parseRes.events.length === 0) {
    throw new Error(`Gagal mem-parse format iCalendar: ${parseRes.errors.join(", ")}`);
  }

  return { events: parseRes.events, rawContent };
}

/**
 * Sinkronisasi feed iCal untuk sebuah listing ke database (tabel CalendarBlock).
 * Menjamin idempotensi: upsert pada compound key [listingId, uid].
 */
export async function syncIcalToListing(
  prisma: PrismaClient,
  listingId: string,
  rawOrFetchedEvents: ParsedCalendarEvent[] | string,
): Promise<SyncIcalResult> {
  let events: ParsedCalendarEvent[];
  if (typeof rawOrFetchedEvents === "string") {
    const res = parseIcal(rawOrFetchedEvents);
    events = res.events;
  } else {
    events = rawOrFetchedEvents;
  }

  let upsertedCount = 0;
  const errors: string[] = [];
  const now = new Date();
  const validUids: string[] = [];

  for (const event of events) {
    try {
      const startDateTime = fromStayDate(event.startDate);
      const endDateTime = fromStayDate(event.endDate);

      await prisma.calendarBlock.upsert({
        where: {
          listingId_uid: {
            listingId,
            uid: event.uid,
          },
        },
        create: {
          listingId,
          uid: event.uid,
          startDate: startDateTime,
          endDate: endDateTime,
          summary: event.summary,
          source: "ICAL",
          fetchedAt: now,
        },
        update: {
          startDate: startDateTime,
          endDate: endDateTime,
          summary: event.summary,
          fetchedAt: now,
        },
      });
      upsertedCount++;
      validUids.push(event.uid);
    } catch (err) {
      errors.push(`Gagal menyimpan CalendarBlock [${event.uid}]: ${(err as Error).message}`);
    }
  }

  // Bersihkan ghost blocks: hapus blok iCal lama yang sudah dihapus/dibatalkan di OTA dan tidak ada di feed terbaru
  try {
    if (validUids.length > 0) {
      await prisma.calendarBlock.deleteMany({
        where: {
          listingId,
          source: "ICAL",
          uid: { notIn: validUids },
        },
      });
    } else if (events.length === 0 && errors.length === 0) {
      await prisma.calendarBlock.deleteMany({
        where: {
          listingId,
          source: "ICAL",
        },
      });
    }
  } catch (err) {
    errors.push(`Gagal membersihkan ghost blocks iCal: ${(err as Error).message}`);
  }

  return {
    listingId,
    totalParsed: events.length,
    upsertedCount,
    errors,
  };
}
