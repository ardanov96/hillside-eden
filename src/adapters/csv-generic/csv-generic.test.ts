import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { parseLocalizedNumber } from "./number-parser";
import { parseLocalizedDate } from "./date-parser";
import { parseCsvRows } from "./csv-tokenizer";
import { previewCsv } from "./preview";
import { GenericCsvAdapter } from "./adapter";
import type { CsvMappingProfile } from "./profile";
import type { RawInput } from "../types";

describe("adapters/csv-generic (S2-05: Impor CSV generik)", () => {
  describe("DoD S2-05: Tes locale 1.500.000,00 dan 1,500,000.00", () => {
    it("parseLocalizedNumber sukses mengurai angka locale Indonesia (1.500.000,00)", () => {
      const dec1 = parseLocalizedNumber("1.500.000,00", "id-ID");
      expect(dec1.toString()).toBe("1500000");

      const dec2 = parseLocalizedNumber("2.750.500,75", "id-ID");
      expect(dec2.toString()).toBe("2750500.75");

      const dec3 = parseLocalizedNumber("Rp 1.500.000,00", "id-ID");
      expect(dec3.toString()).toBe("1500000");

      const dec4 = parseLocalizedNumber("(1.500.000,00)", "id-ID");
      expect(dec4.toString()).toBe("-1500000");
    });

    it("parseLocalizedNumber sukses mengurai angka locale internasional/US (1,500,000.00)", () => {
      const dec1 = parseLocalizedNumber("1,500,000.00", "en-US");
      expect(dec1.toString()).toBe("1500000");

      const dec2 = parseLocalizedNumber("2,750,500.75", "en-US");
      expect(dec2.toString()).toBe("2750500.75");

      const dec3 = parseLocalizedNumber("$1,500,000.00", "en-US");
      expect(dec3.toString()).toBe("1500000");

      const dec4 = parseLocalizedNumber("-1,500,000.00", "en-US");
      expect(dec4.toString()).toBe("-1500000");
    });

    it("melempar error jika string angka tidak valid", () => {
      expect(() => parseLocalizedNumber("bukan-angka", "id-ID")).toThrow();
      expect(() => parseLocalizedNumber("", "en-US")).toThrow();
    });
  });

  describe("Parser Tanggal Multi-Format (docs/06 §7)", () => {
    it("mengurai format YYYY-MM-DD", () => {
      expect(parseLocalizedDate("2026-10-20")).toBe("2026-10-20");
    });

    it("mengurai format DD/MM/YYYY", () => {
      expect(parseLocalizedDate("20/10/2026")).toBe("2026-10-20");
      expect(parseLocalizedDate("05/01/2026")).toBe("2026-01-05");
    });

    it("mengurai format DD-MM-YYYY", () => {
      expect(parseLocalizedDate("20-10-2026")).toBe("2026-10-20");
      expect(parseLocalizedDate("01-12-2026")).toBe("2026-12-01");
    });

    it("mengurai format D MMM YYYY & D MMMM YYYY (Indonesia)", () => {
      expect(parseLocalizedDate("20 Okt 2026")).toBe("2026-10-20");
      expect(parseLocalizedDate("20 Oktober 2026")).toBe("2026-10-20");
      expect(parseLocalizedDate("5 Agu 2026")).toBe("2026-08-05");
      expect(parseLocalizedDate("17 Agustus 2026")).toBe("2026-08-17");
      expect(parseLocalizedDate("1 Mei 2026")).toBe("2026-05-01");
    });

    it("mengurai format D MMM YYYY & D MMMM YYYY (Inggris)", () => {
      expect(parseLocalizedDate("20 Oct 2026")).toBe("2026-10-20");
      expect(parseLocalizedDate("20 October 2026")).toBe("2026-10-20");
      expect(parseLocalizedDate("5 Aug 2026")).toBe("2026-08-05");
      expect(parseLocalizedDate("5 August 2026")).toBe("2026-08-05");
    });

    it("mengurai ISO Timestamps", () => {
      expect(parseLocalizedDate("2026-10-20T08:30:00.000Z")).toBe("2026-10-20");
    });

    it("melempar error jika tanggal tidak valid", () => {
      expect(() => parseLocalizedDate("31/02/2026")).toThrow(); // 31 Februari tidak ada
      expect(() => parseLocalizedDate("invalid-date")).toThrow();
    });
  });

  describe("CSV Tokenizer (RFC 4180)", () => {
    it("mengurai teks CSV sederhana", () => {
      const csv = "a,b,c\n1,2,3";
      expect(parseCsvRows(csv)).toEqual([
        ["a", "b", "c"],
        ["1", "2", "3"],
      ]);
    });

    it("menangani quoted cells dengan koma dan tanda kutip ganda", () => {
      const csv = 'col1,col2\n"Hello, World!","He said ""Yes"""';
      expect(parseCsvRows(csv)).toEqual([
        ["col1", "col2"],
        ["Hello, World!", 'He said "Yes"'],
      ]);
    });

    it("menangani baris baru CRLF dan UTF-8 BOM", () => {
      const csvWithBom = '\uFEFFname;price\r\n"Villa A";"1.500.000,00"\r\n';
      expect(parseCsvRows(csvWithBom, ";")).toEqual([
        ["name", "price"],
        ["Villa A", "1.500.000,00"],
      ]);
    });
  });

  describe("GenericCsvAdapter dengan Synthetic Fixture (id-ID & en-US)", () => {
    const idProfile: CsvMappingProfile = {
      name: "Tiket.com Ekspor CSV",
      channel: "TIKET_COM",
      delimiter: ";",
      numberLocale: "id-ID",
      dateFormat: "DD/MM/YYYY",
      columns: {
        externalId: "Kode Booking",
        listingName: "Properti",
        status: "Status",
        checkIn: "Tgl Check In",
        checkOut: "Tgl Check Out",
        grossAmount: "Nilai Gross",
        commissionAmount: "Komisi",
        guestName: "Nama Tamu",
      },
    };

    const usProfile: CsvMappingProfile = {
      name: "Airbnb Reservations CSV",
      channel: "AIRBNB",
      delimiter: ",",
      numberLocale: "en-US",
      dateFormat: "YYYY-MM-DD",
      columns: {
        externalId: "Confirmation Code",
        listingName: "Property Name",
        status: "Status",
        checkIn: "Check In",
        checkOut: "Check Out",
        grossAmount: "Gross Revenue",
        commissionAmount: "Commission",
        guestName: "Guest Name",
      },
    };

    it("sukses memparsing fixture synthetic id-ID (titik ribuan, koma desimal, pemisah ;)", () => {
      const fixturePath = path.resolve(
        __dirname,
        "../../../fixtures/synthetic/csv/bookings-id-id.csv",
      );
      const content = fs.readFileSync(fixturePath, "utf-8");

      const adapter = new GenericCsvAdapter(idProfile);
      const input: RawInput = {
        kind: "csv",
        filename: "bookings-id-id.csv",
        content,
      };

      expect(adapter.supports(input)).toBe(true);
      const result = adapter.parse(input);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.events).toHaveLength(3);

        const b1 = result.events[0]!.booking;
        expect(b1.externalId).toBe("TC-101");
        expect(b1.channel).toBe("TIKET_COM");
        expect(b1.checkIn).toBe("2026-10-20");
        expect(b1.checkOut).toBe("2026-10-25");
        expect(b1.grossAmount).toBe("1500000"); // 1.500.000,00
        expect(b1.commissionAmount).toBe("225000"); // 225.000,00
        expect(b1.guestName).toBe("Budi Santoso");

        const b2 = result.events[1]!.booking;
        expect(b2.grossAmount).toBe("2750000.5"); // 2.750.000,50
        expect(b2.commissionAmount).toBe("412500");

        const b3 = result.events[2]!;
        expect(b3.eventType).toBe("CANCELLED");
        expect(b3.booking.status).toBe("CANCELLED");
      }
    });

    it("sukses memparsing fixture synthetic en-US (koma ribuan, titik desimal, pemisah ,)", () => {
      const fixturePath = path.resolve(
        __dirname,
        "../../../fixtures/synthetic/csv/bookings-en-us.csv",
      );
      const content = fs.readFileSync(fixturePath, "utf-8");

      const adapter = new GenericCsvAdapter(usProfile);
      const input: RawInput = {
        kind: "csv",
        filename: "bookings-en-us.csv",
        content,
      };

      const result = adapter.parse(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.events).toHaveLength(3);

        const b1 = result.events[0]!.booking;
        expect(b1.externalId).toBe("AB-201");
        expect(b1.channel).toBe("AIRBNB");
        expect(b1.checkIn).toBe("2026-10-20");
        expect(b1.checkOut).toBe("2026-10-25");
        expect(b1.grossAmount).toBe("1500000"); // "1,500,000.00"
        expect(b1.commissionAmount).toBe("225000");
      }
    });
  });

  describe("Pratinjau CSV (previewCsv, docs/06 §7)", () => {
    const profile: CsvMappingProfile = {
      name: "Test Preview",
      numberLocale: "id-ID",
      columns: {
        externalId: "ID",
        checkIn: "CheckIn",
        checkOut: "CheckOut",
        grossAmount: "Gross",
      },
    };

    it("menghasilkan pratinjau dengan baris valid dan baris error yang ditandai", () => {
      const csv = [
        "ID,CheckIn,CheckOut,Gross",
        "B-01,2026-10-20,2026-10-25,1.500.000,00", // Valid
        "B-02,2026-10-25,2026-10-20,1.000.000,00", // Error: checkOut <= checkIn
        ",2026-10-20,2026-10-25,1.000.000,00", // Error: ID kosong
      ].join("\n");

      const preview = previewCsv(csv, profile);
      expect(preview.headers).toEqual(["ID", "CheckIn", "CheckOut", "Gross"]);
      expect(preview.totalRows).toBe(3);
      expect(preview.validCount).toBe(1);
      expect(preview.errorCount).toBe(2);

      expect(preview.previewRows[0]!.isValid).toBe(true);
      expect(preview.previewRows[0]!.parsed?.externalId).toBe("B-01");

      expect(preview.previewRows[1]!.isValid).toBe(false);
      expect(preview.previewRows[1]!.errors?.[0]).toContain("checkOut");

      expect(preview.previewRows[2]!.isValid).toBe(false);
      expect(preview.previewRows[2]!.errors?.[0]).toContain("ID");
    });

    it("menghormati batas maxRows (default 20 baris)", () => {
      const rows = ["ID,CheckIn,CheckOut,Gross"];
      for (let i = 1; i <= 30; i++) {
        rows.push(`B-${i},2026-10-20,2026-10-25,1.000.000,00`);
      }
      const preview = previewCsv(rows.join("\n"), profile, 10);
      expect(preview.totalRows).toBe(30);
      expect(preview.previewRows).toHaveLength(10);
    });
  });
});
