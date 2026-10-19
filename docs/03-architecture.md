# 03. Arsitektur

## 1. Komponen

```
                 ┌───────────────────────────────┐
 Email OTA ─────▶│ Penerima email (webhook/IMAP) │─┐
 CSV/Excel ─────▶│ Upload (UI)                   │─┤
 Input manual ──▶│ Form (UI)                     │─┼─▶ Penyimpanan raw ─▶ import_batch/item
 iCal (jadwal) ─▶│ Pengambil iCal (worker)       │─┘          │
                 └───────────────────────────────┘            ▼
                                                      Router adapter
                                                              │
                                              parse → validasi (Zod) → resolusi listing
                                                              │
                                        upsert booking idempoten → booking_event → alokasi unit
                                                              │
                                          cek bentrok → audit_log → PostgreSQL
                                                              │
                              SQL view laporan ◀──────────────┘
                                      │
                               Next.js (UI + API) ─▶ Pemilik (satu admin)
```

Dua proses: **web** (Next.js) dan **worker** (ingest terjadwal, pengambil iCal, template biaya rutin, penutupan periode). Keduanya memakai kode domain yang sama.

## 2. Struktur kode

```
src/
  domain/        # murni: KPI, alokasi, komisi, bentrok, aturan periode (tanpa I/O)
  adapters/
    airbnb/  tiket/  traveloka/  csv-generic/  manual/  ical/
  ingest/        # pipeline, router adapter, dedup, antrean/job
  server/        # akses data (Prisma), service, StorageProvider, InboundEmailSource
  app/           # Next.js: halaman, route handler, server action
  lib/           # money, dates, format id-ID, logger, env
prisma/          # schema.prisma, migrations, seed
fixtures/
  real/          # data asli dari client (jangan commit data pribadi mentah; lihat 08)
  synthetic/     # data sintetis berlabel
docs/
```

Aturan dependensi: `domain` tidak mengimpor apa pun dari `server`, `app`, atau `adapters`. `adapters` hanya bergantung pada tipe di `domain` dan Zod. `app` memanggil `server`, bukan Prisma langsung dari komponen UI.

## 3. Alur data

### 3.1 Ingest (semua sumber)
1. **Terima**: simpan input mentah (email `.eml`, berkas CSV, teks manual) lewat `StorageProvider`; buat `import_batch` dan `import_item`.
2. **Rute**: `supports(input)` pada tiap adapter menentukan pemilik. Tidak ada yang cocok → item `NEEDS_REVIEW`.
3. **Parse** → `ParsedBookingEvent[]` atau kesalahan berkode.
4. **Validasi** dengan Zod. Gagal → item `FAILED` (karantina), tidak pernah dibuang diam-diam.
5. **Resolusi listing**: cari `listing` berdasarkan `(channel, externalListingId | nama)`. Tidak terpetakan → `NEEDS_REVIEW`.
6. **Upsert booking** pada kunci `(organization_id, channel, external_id)`. Hitung perubahan dan tulis `booking_event` dengan diff.
7. **Alokasi unit**: bentuk/ubah `booking_unit` (lihat `05` §3).
8. **Cek bentrok** untuk unit dan rentang tanggal terdampak.
9. **Audit** dan kembalikan ringkasan batch (diproses, duplikat, gagal, perlu ditinjau).

### 3.2 Idempotensi dan urutan
- Dedup berdasarkan `content_hash` item dan `(channel, external_id, event_type, occurred_at)`.
- Event tidak berurutan: keadaan akhir ditentukan oleh `occurred_at` terbaru; semua event tetap disimpan.
- Memproses ulang batch yang sama harus menghasilkan keadaan akhir identik.

### 3.3 Mesin status booking
`PENDING → CONFIRMED → CANCELLED | NO_SHOW`. Perubahan tanggal atau nominal bukan status baru, melainkan `booking_event` bertipe `MODIFIED`. Status "selesai" diturunkan dari tanggal, tidak disimpan.

### 3.4 Pembacaan laporan
KPI dihitung saat dibaca lewat SQL view (data kecil). Jika perlu, tambah tabel agregat harian per unit yang disegarkan setelah ingest. Jangan memajukan optimasi ini sebelum S4-05 membuktikan perlu.

### 3.5 "Near-realtime"
Klien menyegarkan data berkala (30-60 detik) lewat TanStack Query. Setiap sumber menampilkan **waktu sinkron terakhir**. Kesegaran data ditampilkan jujur; jangan menyiratkan realtime untuk sumber yang bergantung email atau ekspor.

## 4. Pekerjaan terjadwal (worker)

| Job | Frekuensi (awal) | Fungsi |
|---|---|---|
| `ical.fetch` | tiap 30-60 menit | Ambil jadwal Airbnb → `calendar_block` |
| `email.poll` | tiap 1-5 menit (bila IMAP) | Ambil email baru |
| `expense.recurring` | harian | Buat entri draf dari template |
| `period.reminder` | bulanan | Ingatkan penutupan buku |
| `retention.sweep` | harian | Hapus/anonimkan data tamu lewat masa retensi |
| `heartbeat` | tiap menit | Tanda worker hidup untuk monitoring |

## 5. Penanganan kesalahan

- Parse atau validasi gagal → karantina dengan `error_code`, dapat diproses ulang setelah perbaikan parser.
- Kesalahan sementara (jaringan, DB) → retry dengan backoff, batas percobaan, lalu masuk karantina.
- Semua kegagalan terlihat di halaman "Perlu perhatian" dan memicu alert (lihat `08`).
- Setiap angka di UI yang bergantung pada data tidak lengkap diberi penanda (estimasi, data belum lengkap).

## 6. Multi-properti dan organisasi

Semua tabel domain membawa `organization_id`. Kueri selalu difilter oleh organisasi sesi. Properti adalah dimensi filter, bukan batas keamanan (satu pemilik). Jika kelak perlu multi-tenant, `organization_id` sudah ada; tambahkan row-level scoping.

## 7. Konvensi

- Nama tabel `snake_case`, model Prisma `PascalCase` dengan `@@map`.
- Semua tabel: `id`, `created_at`, `updated_at`. Waktu kejadian memakai `timestamptz`; tanggal menginap memakai `date`.
- Tidak ada penghapusan fisik untuk data keuangan; gunakan status atau entri pembalik.
- Error domain memakai tipe hasil eksplisit (`Result`), bukan melempar untuk alur normal.
