# 01. Rencana Pengembangan dan Sprint

## 1. Asumsi perencanaan

- Sprint berdurasi **1 minggu** (asumsi, dapat disesuaikan). Kapasitas: satu pengembang manusia sebagai reviewer plus beberapa AI agent paralel.
- Ukuran tiket relatif, bukan jam: **S** (kecil, satu sesi), **M** (menengah), **L** (besar, boleh dipecah).
- Sprint 5 dan 6 **diblokir** sampai fixture asli dari client tersedia. Jika fixture datang lebih awal, tarik Sprint 5 ke depan Sprint 3 atau 4, karena data pemasukan lebih bernilai.
- Tidak ada estimasi tanggal pasti. Jadwal bergantung pada kecepatan client menyediakan data (lihat bagian 5).

## 2. Jalur kerja paralel (lane)

| Lane | Fokus | Bisa jalan paralel dengan |
|---|---|---|
| A | Domain dan KPI (`src/domain`) | B, C, D setelah skema ada |
| B | Ingest dan adapter (`src/ingest`, `src/adapters`) | A, C |
| C | Keuangan: pengeluaran, pendapatan lain, penutupan buku | A, B |
| D | UI/Next.js | Semua, setelah kontrak data stabil |
| E | Infra, CI, operasional | Semua |

Urutan ketergantungan: S0 → S1 → (S2 ∥ S3) → S4 → S5/S6 (diblokir) → S7 → S8.

## 3. Sprint

### Sprint 0: Fondasi proyek (lane E)

| ID | Tugas | Ukuran | Selesai bila |
|---|---|---|---|
| S0-01 | Inisialisasi repo Next.js, TypeScript strict, pnpm, struktur folder `03-architecture.md` | S | `pnpm dev` menampilkan halaman awal |
| S0-02 | ESLint, Prettier, commitlint, hook pra-commit | S | Pelanggaran gaya menggagalkan commit |
| S0-03 | Dockerfile (multi-stage), docker-compose (postgres, web, worker kosong), `.env.example` | M | `docker compose up -d` menyalakan Postgres lokal |
| S0-04 | CI: lint, typecheck, test, `prisma validate` | S | Pipeline hijau pada PR |
| S0-05 | Prisma init, koneksi, endpoint `/api/health` | S | Health cek DB berhasil |
| S0-06 | Salin docs dan AGENTS.md ke repo, buat `docs/DECISIONS.md` | S | Dokumen ada di repo |

### Sprint 1: Skema, autentikasi, domain dasar (lane A, D, E)

| ID | Tugas | Ukuran | Selesai bila |
|---|---|---|---|
| S1-01 | Skema Prisma v0 sesuai `04-data-model.md` + migrasi awal | L | `prisma migrate` bersih, `prisma validate` lulus |
| S1-02 | Seed: organisasi, 2 properti, unit, listing, `inventory_config`, kategori default | M | Seed idempoten |
| S1-03 | Auth.js (credentials), satu user owner dari seed/CLI, proteksi semua route | M | Route tanpa login ditolak |
| S1-04 | Modul `money` (Decimal) dan `dates` (WITA, format id-ID) + tes | S | Tes pembulatan dan zona waktu lulus |
| S1-05 | KPI: alokasi malam, revenue per periode, okupansi, ADR, RevPAR + tes (termasuk property-based) | L | Aturan `05-business-rules.md` §2 terpenuhi |
| S1-06 | Generator data dummy (lihat §4) | M | Dataset dummy bisa dimuat ulang deterministik |

### Sprint 2: Ingest inti dan input manual (lane B, D)

| ID | Tugas | Ukuran | Selesai bila |
|---|---|---|---|
| S2-01 | Kontrak adapter dan tipe `NormalizedBooking` | S | Tipe ada, didokumentasikan |
| S2-02 | Pipeline ingest: simpan raw, `import_batch/item`, resolusi listing, upsert idempoten, `booking_event` diff, alokasi unit | L | Impor ulang berkas sama tidak menggandakan data |
| S2-03 | Karantina dan halaman "Perlu perhatian" | M | Item gagal/tidak terpetakan terlihat dan bisa diproses ulang |
| S2-04 | Form booking manual (adapter `MANUAL`) | M | Booking manual masuk lewat pipeline yang sama |
| S2-05 | Impor CSV generik: profil pemetaan, parser angka dan tanggal locale Indonesia | L | Tes locale `1.500.000,00` dan `1,500,000.00` lulus |
| S2-06 | Deteksi bentrok jadwal (domain) + tes | M | Estate vs unit terdeteksi |
| S2-07 | Halaman Bookings: tabel, filter, detail dengan riwayat | M | Perubahan dan pembatalan terlihat di riwayat |

### Sprint 3: Pengeluaran dan pendapatan lain (lane C, D). Paralel dengan Sprint 2

| ID | Tugas | Ukuran | Selesai bila |
|---|---|---|---|
| S3-01 | CRUD kategori dan pengeluaran | M | Validasi dan filter berfungsi |
| S3-02 | Unggah struk lewat `StorageProvider` (lokal untuk dev) | M | Batas ukuran dan tipe file ditegakkan |
| S3-03 | Template biaya rutin + penjadwal | M | Entri draf terbentuk otomatis |
| S3-04 | Impor CSV pengeluaran | M | Pemetaan kolom tersimpan |
| S3-05 | Aturan alokasi biaya bersama + tes | M | Jumlah alokasi selalu sama dengan biaya asal |
| S3-06 | Pendapatan lain (manual) | S | Tampil di ringkasan |
| S3-07 | Status draf/terverifikasi, entri pembalik, `audit_log` | M | Entri terverifikasi tidak bisa diedit |
| S3-08 | Tutup buku bulanan dengan snapshot | M | Periode terkunci menolak perubahan |

### Sprint 4: Dashboard v1 dengan data dummy (lane D, A)

| ID | Tugas | Ukuran | Selesai bila |
|---|---|---|---|
| S4-01 | Layout, navigasi, filter global (properti, periode) | M | Filter memengaruhi semua halaman |
| S4-02 | Ringkasan: kartu, grafik bulanan, tabel per OTA dan properti, badge estimasi/aktual | L | Angka cocok dengan perhitungan manual dataset uji |
| S4-03 | Kalender okupansi per unit, penanda bentrok, `calendar_block` | L | Bentrok terlihat jelas |
| S4-04 | Indikator kesegaran data per sumber | S | Waktu sinkron terakhir tampil |
| S4-05 | Query laporan via SQL view; uji performa dengan data sintetis besar | M | Halaman utama memuat wajar pada 50 ribu booking sintetis |
| S4-06 | Demo ke client dengan data dummy dan catat umpan balik | S | Catatan masuk ke `DECISIONS.md` |

### Sprint 5: Adapter Airbnb (**diblokir: fixture asli**) (lane B)

| ID | Tugas | Ukuran |
|---|---|---|
| S5-01 | Intake fixture dan anotasi | S |
| S5-02 | Parser CSV reservasi dan riwayat transaksi | M |
| S5-03 | Parser email konfirmasi, perubahan, pembatalan | L |
| S5-04 | Pengambil iCal (aman dari SSRF) menjadi `calendar_block` | M |
| S5-05 | Penerima email masuk (sesuai provider yang diputuskan) | L |

Selesai bila tiap parser lulus minimal 5 fixture asli, termasuk pembatalan dan modifikasi.

### Sprint 6: Adapter Tiket.com dan Traveloka (**diblokir: akses dan fixture**) (lane B)

| ID | Tugas | Ukuran |
|---|---|---|
| S6-01 | Verifikasi akses extranet dan sumber distribusi (DECISIONS OD-10, OD-11) | S |
| S6-02 | Parser email/ekspor Tiket.com | L |
| S6-03 | Parser email/ekspor Traveloka | L |
| S6-04 | Pemetaan listing↔unit final | S |

### Sprint 7: Komisi dan rekonsiliasi (lane A, C, D)

| ID | Tugas | Ukuran |
|---|---|---|
| S7-01 | CRUD `commission_rule` dan estimasi komisi | M |
| S7-02 | Impor payout/laporan pembayaran, tautkan ke booking | L |
| S7-03 | Alur estimasi → aktual dan tampilan selisih | M |
| S7-04 | Komisi terutang (hotel collect) dan tab kas | M |
| S7-05 | Kartu gross → komisi → pendapatan bersih berdampingan | S |

### Sprint 8: Laporan dan rilis (lane C, D, E)

| ID | Tugas | Ukuran |
|---|---|---|
| S8-01 | Laporan bulanan pemilik (PDF dan Excel) | L |
| S8-02 | Backup terjadwal dan uji restore | M |
| S8-03 | Monitoring, alert kegagalan, heartbeat worker | M |
| S8-04 | Tinjauan keamanan dan checklist pengerasan (`08-quality-security-ops.md`) | M |
| S8-05 | UAT dengan pemilik, deploy produksi, dokumentasi serah terima | M |

## 4. Spesifikasi data dummy (S1-06)

- 2 properti: satu dengan estate (4 unit: villa + 3 cottage, juga dijual sebagai paket), satu dengan 4 kamar di mana hanya 2 yang `isSellable`.
- 3 OTA (Airbnb, Tiket.com, Traveloka) dengan beberapa listing per OTA.
- 12-18 bulan booking, campuran: terkonfirmasi, dibatalkan (dengan dan tanpa biaya), modifikasi tanggal, booking estate, mata uang IDR dan USD, hotel collect dan channel collect.
- Satu bentrok sengaja (estate bertabrakan dengan unit).
- Pengeluaran per kategori, termasuk biaya rutin dan biaya bersama.
- Seed memakai nilai acak berbenih tetap agar tes deterministik.

## 5. Dependensi eksternal (penghambat)

Daftar lengkap ada di `ROADMAP.md` bagian 10. Tiket yang bergantung padanya: S5-*, S6-*, S7-02, S3-04 (contoh CSV pengeluaran), S1-02 (daftar unit dan kategori final).

## 6. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Fixture asli terlambat | Sprint 5-7 tertunda | Selesaikan S0-S4 dengan data dummy dan demo lebih dulu |
| Akses extranet tidak sah atau berbeda dari dugaan | Sumber data tidak ada | Verifikasi di S6-01 sebelum menulis parser |
| Format email OTA berubah | Parser rusak | Karantina, tes fixture, alert kegagalan parse |
| Hosting belum diputuskan | Worker dan antrean terhambat | Kode agnostik, keputusan di OD-02/OD-03 sebelum S5-05 |
| Akurasi bergantung disiplin input pengeluaran | Ringkasan keliru | Input mudah, status verifikasi, tutup buku |
| Scope creep (potongan tambahan, fitur OTA lain) | Jadwal molor | Backlog ketat, tiket baru hanya dengan persetujuan |
| Listing Tiket.com ternyata hasil distribusi Expedia | Data booking ada di Expedia | OD-11, sesuaikan adapter |

## 7. Definition of Ready dan Done

**Ready:** tiket punya acuan dokumen, kriteria selesai terukur, dan tidak bergantung pada keputusan terbuka.
**Done:** kode dan tes hijau; lint dan typecheck lulus; migrasi aman (lihat `08`); dokumen dan `DECISIONS.md` diperbarui; tidak ada TODO tanpa tiket; PR direview.
