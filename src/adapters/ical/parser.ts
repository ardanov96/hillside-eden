/**
 * Parser format iCalendar (RFC 5545) murni dan deterministik.
 * Tiket: S5-04.
 *
 * Mengubah teks VCALENDAR menjadi daftar event CalendarBlock.
 * Mengikuti spesifikasi docs/06 §4 & docs/04 data-model CalendarBlock.
 */
import { addDays, isStayDate, type StayDate } from "@/lib/dates";

export interface ParsedCalendarEvent {
  uid: string;
  startDate: StayDate; // YYYY-MM-DD
  endDate: StayDate; // YYYY-MM-DD (eksklusif/tanggal check-out)
  summary?: string;
  description?: string;
}

export interface IcalParseResult {
  ok: boolean;
  events: ParsedCalendarEvent[];
  errors: string[];
}

/**
 * Membuka lipatan baris (line unfolding RFC 5545 §3.1).
 * Baris baru yang diawali spasi atau tab adalah sambungan dari baris sebelumnya.
 */
export function unfoldIcalLines(rawText: string): string[] {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n");
  const unfolded: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  return unfolded.map((l) => l.trim()).filter((l) => l.length > 0);
}

/**
 * Parsing tanggal dari format iCal (YYYYMMDD atau YYYYMMDDTHHMMSSZ).
 * Mengembalikan string format 'YYYY-MM-DD'.
 */
export function parseIcalDateString(dateStr: string): StayDate | null {
  // Bersihkan parameter (mis. VALUE=DATE:20261020 atau TZID=Asia/Makassar:20261020T120000)
  const cleanStr = dateStr.includes(":") ? dateStr.split(":").pop()! : dateStr;
  const trimmed = cleanStr.trim();

  // Pola YYYYMMDD
  if (/^\d{8}/.test(trimmed)) {
    const year = trimmed.slice(0, 4);
    const month = trimmed.slice(4, 6);
    const day = trimmed.slice(6, 8);
    const formatted = `${year}-${month}-${day}`;
    return isStayDate(formatted) ? (formatted as StayDate) : null;
  }

  return null;
}

/**
 * Parsing teks iCalendar menjadi ParsedCalendarEvent[].
 */
export function parseIcal(content: string): IcalParseResult {
  const lines = unfoldIcalLines(content);
  const events: ParsedCalendarEvent[] = [];
  const errors: string[] = [];

  let inVEvent = false;
  let currentUid: string | undefined;
  let currentStart: StayDate | undefined;
  let currentEnd: StayDate | undefined;
  let currentSummary: string | undefined;
  let currentDescription: string | undefined;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inVEvent = true;
      currentUid = undefined;
      currentStart = undefined;
      currentEnd = undefined;
      currentSummary = undefined;
      currentDescription = undefined;
      continue;
    }

    if (line === "END:VEVENT") {
      if (inVEvent) {
        if (!currentUid) {
          errors.push("VEVENT diabaikan: UID tidak ditemukan");
        } else if (!currentStart) {
          errors.push(`VEVENT [${currentUid}] diabaikan: DTSTART tidak ditemukan atau tidak valid`);
        } else {
          // Bila DTEND tidak ada, default RFC 5545 adalah DTSTART + 1 hari
          const endDate = currentEnd ?? addDays(currentStart, 1);

          events.push({
            uid: currentUid,
            startDate: currentStart,
            endDate,
            summary: currentSummary,
            description: currentDescription,
          });
        }
      }
      inVEvent = false;
      continue;
    }

    if (inVEvent) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;

      const propHeader = line.slice(0, colonIdx);
      const propValue = line.slice(colonIdx + 1);
      const propName = propHeader.split(";")[0]?.toUpperCase() ?? "";

      switch (propName) {
        case "UID":
          currentUid = propValue.trim();
          break;
        case "DTSTART": {
          const parsed = parseIcalDateString(line);
          if (parsed) currentStart = parsed;
          break;
        }
        case "DTEND": {
          const parsed = parseIcalDateString(line);
          if (parsed) currentEnd = parsed;
          break;
        }
        case "SUMMARY":
          currentSummary = propValue.trim();
          break;
        case "DESCRIPTION":
          currentDescription = propValue.trim();
          break;
      }
    }
  }

  return {
    ok: errors.length === 0,
    events,
    errors,
  };
}
