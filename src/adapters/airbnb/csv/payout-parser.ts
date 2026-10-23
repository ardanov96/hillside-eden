/**
 * Parser CSV Transaksi / Payout Airbnb (S5-02).
 *
 * Menerima ekspor riwayat transaksi dari extranet Airbnb dan menghasilkan ParsedPayout[].
 */
import type { ParsedPayout } from "@/adapters/types";
import { parseCsvRows } from "@/adapters/csv-generic/csv-tokenizer";
import { isStayDate, type StayDate } from "@/lib/dates";

export function parseAirbnbPayoutCsv(content: string): {
  payouts: ParsedPayout[];
  errors: string[];
} {
  const rows = parseCsvRows(content);
  const payouts: ParsedPayout[] = [];
  const errors: string[] = [];

  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row[0]?.startsWith("#")) continue;
    const joined = row.map((c) => c.toLowerCase().trim()).join(",");
    if (joined.includes("paid out") || (joined.includes("type") && joined.includes("amount"))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1 || !rows[headerRowIndex]) {
    return {
      payouts: [],
      errors: ["Header ekspor transaksi / payout Airbnb tidak ditemukan"],
    };
  }

  const header = rows[headerRowIndex]!.map((c) => c.toLowerCase().trim());
  const colIndex = {
    date: header.findIndex((h) => h === "date" || h === "tanggal"),
    type: header.findIndex((h) => h === "type" || h === "tipe"),
    code: header.findIndex(
      (h) => h.includes("confirmation") || h.includes("code") || h.includes("referensi"),
    ),
    amount: header.findIndex((h) => h === "amount" || h === "jumlah"),
    paidOut: header.findIndex((h) => h.includes("paid out") || h.includes("dibayarkan")),
    currency: header.findIndex((h) => h === "currency" || h === "mata uang"),
    details: header.findIndex((h) => h === "details" || h === "rincian"),
  };

  // Kumpulkan bookingExternalIds per payout reference bila ada
  const relatedBookingCodes: string[] = [];

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0 || row.every((c) => c.trim() === "")) continue;

    const rowType = (colIndex.type >= 0 ? (row[colIndex.type] ?? "") : "").toLowerCase().trim();
    const code = colIndex.code >= 0 ? (row[colIndex.code]?.trim() ?? "") : "";
    if (code && rowType.includes("reservation")) {
      relatedBookingCodes.push(code);
    }

    if (rowType.includes("payout")) {
      const dateRaw = (colIndex.date >= 0 ? (row[colIndex.date] ?? "") : "").trim();
      const payoutDate: StayDate = isStayDate(dateRaw) ? (dateRaw as StayDate) : "1970-01-01";

      const rawPaidOut = colIndex.paidOut >= 0 ? row[colIndex.paidOut] : undefined;
      const rawAmt = colIndex.amount >= 0 ? row[colIndex.amount] : undefined;
      const rawAmount = rawPaidOut || rawAmt || "0";
      const cleanedAmount = rawAmount.replace(/[^0-9.-]/g, "");
      const amount = Number.parseFloat(cleanedAmount || "0").toFixed(2);

      const rawCurrency = colIndex.currency >= 0 ? row[colIndex.currency]?.trim() : undefined;
      const currency = rawCurrency ? rawCurrency.toUpperCase() : "IDR";

      payouts.push({
        channel: "AIRBNB",
        reference: code || `PAYOUT-${payoutDate}`,
        payoutDate,
        amount,
        currency,
        bookingExternalIds: [...relatedBookingCodes],
      });
    }
  }

  return { payouts, errors };
}
