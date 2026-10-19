# 06. Ingest dan Adapter

## 1. Gambaran

Tidak ada API OTA yang tersedia untuk developer independen (asumsi kerja). Data masuk lewat: **email notifikasi**, **ekspor CSV/Excel**, **iCal (hanya tanggal)**, dan **input manual**. Semuanya melewati pipeline yang sama (`03-architecture.md` §3.1). Menambah sumber = menambah satu adapter.

## 2. Kontrak adapter (TypeScript)

```ts
export type ChannelCode =
  | 'AIRBNB' | 'TIKET_COM' | 'TRAVELOKA' | 'EXPEDIA' | 'AGODA' | 'BOOKING_COM' | 'DIRECT' | 'MANUAL';

export type RawInput =
  | { kind: 'email'; receivedAt: Date; from: string; subject: string; text?: string; html?: string; headers: Record<string, string>; storageKey: string }
  | { kind: 'csv'; filename: string; content: Buffer; mappingProfileId?: string }
  | { kind: 'ical'; listingId: string; content: string }
  | { kind: 'manual'; payload: unknown };

export interface NormalizedBooking {
  channel: ChannelCode;
  externalId: string;                  // kode konfirmasi OTA
  externalListingId?: string;
  listingName?: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW';
  bookedAt?: Date;                     // bila tidak ada, pipeline memakai waktu diterima dan menandai approx
  checkIn: string;                     // 'YYYY-MM-DD' (WITA)
  checkOut: string;                    // 'YYYY-MM-DD'
  guestsCount?: number;
  guestName?: string;                  // dipotong/inisial sesuai kebijakan PII
  countryCode?: string;
  currency: string;
  grossAmount?: string;                // Decimal sebagai string
  taxesCollected?: string;
  cancellationFee?: string;
  commissionAmount?: string;
  commissionRate?: string;
  collectType?: 'CHANNEL_COLLECT' | 'HOTEL_COLLECT' | 'UNKNOWN';
  payoutAmount?: string;
  payoutDate?: string;
}

export interface ParsedBookingEvent {
  eventType: 'CREATED' | 'MODIFIED' | 'CANCELLED' | 'NO_SHOW';
  occurredAt: Date;
  booking: NormalizedBooking;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

export type ParseResult =
  | { ok: true; events: ParsedBookingEvent[]; payouts?: ParsedPayout[] }
  | { ok: false; errorCode: ParseErrorCode; message: string };

export type ParseErrorCode =
  | 'UNSUPPORTED_FORMAT' | 'MISSING_FIELD' | 'INVALID_VALUE' | 'AMBIGUOUS' | 'UNKNOWN';

export interface SourceAdapter {
  id: string;                          // mis. 'airbnb.email.v1'
  channel: ChannelCode;
  supports(input: RawInput): boolean;  // cepat, tanpa efek samping
  parse(input: RawInput): Promise<ParseResult>;
}
```

Aturan adapter:
- **Murni dan deterministik**: input sama → keluaran sama. Tidak ada jaringan, tidak ada LLM.
- Tidak menulis ke database. Pipeline yang menulis.
- Jangan menebak: bila field wajib tidak ada atau ambigu, kembalikan `ok:false` atau turunkan `confidence` dan beri `warnings`.
- Setiap versi format punya `id` berversi (`...v1`, `...v2`) agar perubahan format OTA bisa ditangani berdampingan.
- Field minimal untuk booking valid: `channel`, `externalId`, `status`, `checkIn`, `checkOut`, `currency`, dan `grossAmount` (kecuali untuk event pembatalan).

## 3. Pipeline (ringkas)

1. Simpan raw → `ImportBatch/ImportItem` (`contentHash` untuk dedup).
2. Router: ambil adapter pertama yang `supports(input)`. Dua adapter cocok sekaligus = kesalahan konfigurasi (log keras).
3. `parse` → validasi Zod terhadap `NormalizedBooking`.
4. Resolusi listing (lihat §6). Gagal → `NEEDS_REVIEW`.
5. Upsert idempoten pada `(organizationId, channel, externalId)`, tulis `BookingEvent` dengan diff, bentuk alokasi unit.
6. Cek bentrok; audit.
7. Statistik batch: diproses, duplikat, gagal, perlu ditinjau.

## 4. Sumber dan jalur

| Sumber | Jalur | Pemicu | Isi yang diharapkan | Status fixture |
|---|---|---|---|---|
| Airbnb | CSV reservasi, CSV riwayat transaksi, email konfirmasi/ubah/batal, iCal | Unggah, email masuk, job iCal | Kode konfirmasi, tanggal, tamu, nilai, biaya layanan, payout | **Menunggu** |
| Tiket.com | Email notifikasi, ekspor extranet | Email masuk, unggah | Lihat catatan OD-11 | **Menunggu** + akses belum terverifikasi |
| Traveloka | Email notifikasi, ekspor extranet | Email masuk, unggah | Lihat catatan OD-10 | **Menunggu** + identitas listing belum jelas |
| Manual | Form UI | Pengguna | Sama dengan `NormalizedBooking` | Tidak perlu |
| CSV generik | Berkas apa pun + profil pemetaan | Unggah | Sesuai pemetaan | Tidak perlu |
| iCal | URL iCal per listing | Job terjadwal | Hanya tanggal (`CalendarBlock`) | Sintetis cukup |

**iCal tidak pernah menjadi booking** dan tidak masuk revenue. Hanya `CalendarBlock` untuk deteksi bentrok dan pemeriksaan silang okupansi.

## 5. Email masuk

- Alamat khusus (mis. `bookings@<domain-client-atau-proyek>`). Client menambahkannya sebagai alamat notifikasi tambahan di extranet OTA, atau memasang aturan teruskan otomatis.
- Penerimaan lewat `InboundEmailSource` (webhook penyedia atau IMAP; **OD-04**). Antarmuka mengembalikan `RawInput` bertipe `email` dan menyimpan `.eml` asli.
- **Keamanan:** daftar putih domain pengirim OTA, periksa hasil SPF/DKIM bila disediakan penyedia, abaikan lampiran eksekutabel, jangan membuka atau mengikuti tautan, batasi ukuran, bersihkan HTML sebelum parsing.
- Email yang diteruskan (forward) dapat berubah susunannya. Adapter harus menangani email asli dan hasil teruskan, dan fixture harus memuat keduanya.
- Email yang tidak dikenali → `NEEDS_REVIEW`, bukan dibuang.

## 6. Resolusi listing

Urutan pencarian: `(channel, externalListingId)` → `(channel, nama listing persis)` → tidak ketemu = `NEEDS_REVIEW`. Pemetaan diselesaikan di UI Pengaturan: menautkan listing ke satu atau banyak unit. Jangan membuat listing otomatis dari data tak dikenal tanpa persetujuan pengguna.

## 7. Impor CSV generik

- **Profil pemetaan** (`ImportMappingProfile`): kolom → field, format tanggal, pemisah desimal/ribuan, encoding, baris header, nilai status → `BookingStatus`.
- Dukung angka locale Indonesia (`1.500.000,00`) dan internasional (`1,500,000.00`); deteksi lewat profil, bukan tebakan diam-diam.
- Format tanggal yang didukung minimal: `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`, `D MMM YYYY` (nama bulan Indonesia dan Inggris).
- Pratinjau 20 baris pertama dengan hasil parsing sebelum konfirmasi impor; baris bermasalah ditandai.
- Impor ulang berkas sama tidak menggandakan data (dedup `contentHash` + kunci booking).

## 8. Fixture dan tes parser

- `fixtures/real/<channel>/<jenis>/<nomor>.<ext>` untuk data asli; `fixtures/synthetic/...` untuk buatan, dengan komentar header "SINTETIS".
- **Data asli wajib dianonimkan** (nama, email, telepon, alamat tamu) sebelum masuk repo. Simpan kode konfirmasi dan angka sebagaimana adanya bila tidak mengidentifikasi orang.
- Setiap fixture punya berkas `*.expected.json` (hasil parse yang benar). Tes memakai pola **golden file**.
- Cakupan minimal per adapter: booking baru, perubahan tanggal, perubahan nilai, pembatalan (dengan dan tanpa biaya), mata uang non-IDR bila relevan, dan satu kasus rusak yang harus gagal dengan benar.
- Parser dianggap selesai bila lulus ≥5 fixture asli (lihat `01` Sprint 5-6).

## 9. Payout dan rekonsiliasi

- Parser dapat menghasilkan `ParsedPayout` (tanggal, jumlah, referensi, daftar booking terkait).
- Pipeline menautkan payout ke booking lewat `PayoutBooking`, memperbarui komisi menjadi `ACTUAL`, dan mencatat selisih terhadap estimasi (`05` §5).
- Payout yang tidak cocok dengan booking mana pun → `NEEDS_REVIEW`.

## 10. Menambah OTA baru (checklist)

1. Dapatkan fixture asli dan konfirmasi akses/sumber (jangan menulis parser tanpa fixture).
2. Tambahkan nilai `ChannelCode` bila belum ada (migrasi).
3. Buat folder `src/adapters/<channel>/` dengan adapter berversi dan tes golden.
4. Tambahkan aturan komisi dan `collectType` default (`CommissionRule`).
5. Tambahkan listing dan pemetaan unit di Pengaturan.
6. Perbarui `06` §4 dan `DECISIONS.md`.
