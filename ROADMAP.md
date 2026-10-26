# Brief & Roadmap: Dashboard Monitoring Booking dan Keuangan (Hillside Eden)

Versi 0.1 · 19 Oktober 2026 · Pengelola proyek: BaliHoster (freelance) · Dokumen ini ditujukan untuk AI agent pelaksana.

## 1. Tujuan

Membangun dashboard web untuk **satu pemilik dengan banyak properti** yang menampilkan, secara akurat:

1. Kinerja booking dari setiap OTA yang sudah live (prioritas awal: **Tiket.com, Traveloka, Airbnb**).
2. Pemasukan dikurangi pengeluaran operasional standar, per properti dan gabungan.
3. Gross dan net (setelah komisi OTA) **berdampingan**, supaya pemilik tahu berapa yang disetor ke OTA dan berapa yang tersisa.

Di luar scope sekarang: website direct booking, channel manager, potongan tambahan selain komisi OTA (lihat bagian 11).

## 2. Konteks dan fakta

- Client: pemilik villa di Bali dengan **minimal dua properti**, dilihat dalam **satu dashboard**:
  - Hillside Eden (Payangan, Desa Puhu/Penginyahan, Gianyar). Menurut listing OTA grup Expedia: villa 4 kamar + 3 design cottage, dijual sebagai satu paket estate dan per unit.
  - Ubud Hillside (Kecamatan Ubud, Bentuyung), terlihat di Airbnb.
- Client **belum memakai channel manager atau PMS**. Harga dan ketersediaan dikelola manual di tiap extranet (asumsi, belum dikonfirmasi).
- Website official client (hillsideedenubud.com) belum punya direct booking. mjvilla.com hanya referensi untuk fase jauh ke depan.
- Diasumsikan **tidak ada API OTA** untuk developer independen. Jalur data: email notifikasi, ekspor CSV/Excel dari extranet, iCal (hanya tanggal), dan input manual.

### Listing prioritas

| Platform | URL | Catatan verifikasi |
|---|---|---|
| Tiket.com (Homes) | https://www.tiket.com/id-id/homes/indonesia/hillside-eden-bali-108001534518821159 | Lokasi cocok Payangan. Teks konten bergaya Expedia, jadi mungkin bersumber distribusi Expedia. **Belum terverifikasi apakah client punya extranet tiket.com** |
| Traveloka | https://www.traveloka.com/id-id/hotel/indonesia/hillside-eden-jungle-estate-9000005507737 | Halaman tidak bisa dibuka otomatis. Nama berbeda dari hasil pencarian sebelumnya ("Hillside Eden Bali, Gianyar"). **Identitas listing belum jelas** |
| Airbnb | https://www.airbnb.co.id/rooms/1009025545235278907 | "Ubud Hillside", 4 kamar, kapasitas 4 tamu. Hanya 2 kamar pribadi yang disewakan |

Properti juga tampil di Expedia Group (Expedia, Hotels.com, Travelocity; dua listing untuk estate yang sama) dan Agoda. Itu **backlog**, bukan fase awal.

## 3. Keputusan final

- Dashboard adalah proyek utama.
- **Satu organisasi, banyak properti.** Satu admin (pemilik) dulu. Siapkan enum peran (owner, manager, staff), tetapi hanya `owner` yang diimplementasikan. Tambahkan `organization_id` di tabel inti, tanpa UI multi-tenant.
- **Revenue dan okupansi berdasarkan tanggal menginap.** Pace dan lead time berdasarkan tanggal booking dibuat. Kas berdasarkan tanggal payout.
- **Gross dan net berdampingan.** Komisi dibedakan *estimasi* (dari tarif kontrak) dan *aktual* (dari payout atau laporan). Catat model pembayaran per booking: `channel_collect` atau `hotel_collect`. Tampilkan komisi terutang untuk hotel collect.
- Penamaan di UI: **"Pendapatan bersih (setelah komisi OTA)"** dan **"Hasil operasional"**. Jangan memakai istilah "net income" atau "laba".
- Modul pengeluaran standar operasional: input manual, tutup buku bulanan, koreksi lewat entri pembalik.
- **Dilarang scraping** halaman OTA atau mengotomasi login ke extranet.
- Stack: Next.js (App Router, TypeScript), PostgreSQL, Prisma untuk CRUD dan migrasi, SQL mentah atau view untuk query laporan, worker dengan antrean, Docker. Kode harus **agnostik hosting**.

## 4. Belum diputuskan (jangan dikunci tanpa konfirmasi)

- Hosting database (opsi: Neon berbayar tanpa scale-to-zero, AWS RDS, Supabase, atau Postgres sendiri) dan hosting aplikasi (VPS atau Vercel). **Ditahan.**
- Identitas listing Traveloka dan sumber distribusi Tiket.com.
- Kebijakan data tamu. Default sementara: simpan minimal (nama atau inisial, negara, tanpa kontak) dan tentukan masa retensi.
- Alokasi booking estate ke unit. Default: proporsional terhadap tarif atau kapasitas unit, dengan nilai asli tetap disimpan di tingkat booking.
- Daftar kategori pengeluaran final (default di bagian 8, selaraskan dengan akuntan client).
- Ada tidaknya pemasukan non-OTA (tamu langsung, F&B, spa, antar-jemput).

## 5. Arsitektur

```
Sumber (Airbnb, Tiket.com, Traveloka, input manual, CSV)
   → Adapter (parser, normalisasi ke skema booking standar)
   → Pipeline ingest idempoten (antrean/worker)
   → PostgreSQL
   → Dashboard Next.js
```

Menambah OTA baru berarti menambah satu adapter, tanpa mengubah dashboard. Struktur kode yang disarankan:

```
src/domain/      # KPI, aturan bisnis (murni, tanpa I/O)
src/adapters/    # satu folder per sumber, mengimplementasikan kontrak adapter
src/ingest/      # pipeline, dedup, antrean
src/app/         # Next.js
prisma/          # skema, migrasi, seed
fixtures/        # contoh email/CSV (asli vs sintetis dipisah jelas)
docs/DECISIONS.md
```

## 6. Definisi KPI

Zona waktu: `Asia/Makassar` (WITA). Uang: `Decimal`, bukan float, selalu sertakan mata uang dan kurs.

- **Room nights terjual**: jumlah malam booking terkonfirmasi yang jatuh dalam periode (basis tanggal menginap).
- **Room nights tersedia**: per unit, kapasitas yang dijual (`inventory_config`, berlaku per rentang waktu) × jumlah hari.
- **Okupansi** = terjual / tersedia. Level portofolio dihitung dari **total / total**, bukan rata-rata persentase.
- **Revenue kamar (gross)**: nilai booking dibagi rata per malam menginap, dialokasikan ke periode menginap. Booking batal tidak dihitung, kecuali ada biaya pembatalan yang tercatat sebagai baris terpisah.
- **ADR** = revenue kamar / room nights terjual. **RevPAR** = revenue kamar / room nights tersedia.
- **Pendapatan bersih** = gross − komisi OTA (estimasi atau aktual, selalu diberi label).
- **Hasil operasional** = pendapatan bersih + pendapatan lain − pengeluaran.
- **Lead time** = tanggal check-in − tanggal booking dibuat. **Tingkat pembatalan** = booking batal / booking dibuat dalam periode.
- **Kas masuk** berdasarkan tanggal payout. Tampilkan selisih terhadap pendapatan yang sudah terjadi tetapi belum cair.

## 7. Model data (v0)

`organization`, `property`, `unit`, `listing` (OTA, ID eksternal, properti), `listing_unit` (pemetaan banyak ke banyak, mendukung listing gabungan), `inventory_config`, `booking` (sumber, ID eksternal, status, tanggal, gross, pajak yang dipungut, komisi, `commission_basis`, `collect_type`, net, mata uang, kurs, `raw_payload`), `booking_event` (riwayat perubahan), `guest` (minimal), `payout`, `commission_rule` (per listing, berlaku per rentang waktu), `import_batch`, `expense`, `expense_category`, `recurring_expense_template`, `allocation_rule`, `other_income`, `period_lock`, `audit_log`, `user`.

Kunci idempotensi booking: `source + external_id`.

## 8. Roadmap per fase

### Fase 0: Fondasi (tidak butuh data client)
- [x] Repo, lint, format, typecheck, CI, Dockerfile dan docker-compose (app + postgres), `.env.example`.
- [x] Skema Prisma v0, migrasi, seed.
- [x] Autentikasi satu user owner (Auth.js), enum peran disiapkan.
- [x] Generator data dummy: 2 properti, unit sesuai bagian 2, 3 OTA, kasus tepi (modifikasi, pembatalan, booking seluruh estate, hanya 2 kamar disewakan, mata uang berbeda).
- [x] Library KPI di `src/domain` dengan unit test.
- [x] Deteksi bentrok jadwal, termasuk estate vs unit.
- [x] Kontrak adapter dan pipeline ingest idempoten (`import_batch`, dedup, `booking_event`).
- [x] Impor CSV generik (pemetaan kolom) dan form booking manual.

**Selesai bila:** `docker compose up` berjalan, seed menghasilkan dashboard terisi, semua tes KPI hijau.

### Fase 1: Pengeluaran dan ringkasan (paralel dengan Fase 0 setelah skema ada)
- [x] Kategori default (bisa diubah): gaji dan tunjangan, utilitas, housekeeping/laundry/amenities, F&B, perawatan dan perbaikan, pemasaran dan software, pajak/perizinan/asuransi, transportasi dan operasional lain, sewa/lease.
- [ ] Form pengeluaran ramah ponsel, unggah foto struk, template biaya rutin, impor CSV (tiket S3-01 s/d S3-04).
- [ ] Alokasi biaya bersama antar properti (persentase tetap atau proporsional room-night) (tiket S3-05).
- [ ] Pendapatan lain (manual) (tiket S3-06).
- [ ] Status draf/terverifikasi, koreksi lewat entri pembalik, log audit di UI (tiket S3-07).
- [x] Tutup buku bulanan (`period_lock`) dengan snapshot historis & deteksi variansi (diselesaikan di S8-01).
- [x] Halaman ringkasan: pemasukan − pengeluaran = hasil operasional, per properti, gabungan, bulan, dan tahun berjalan, dengan pembanding periode sebelumnya.

**Selesai bila:** ringkasan cocok dengan perhitungan manual pada dataset uji, dan periode terkunci menolak perubahan.

### Fase 2: Adapter pemasukan (**terverifikasi sintetis**, siap intake fixture asli)
- [x] Airbnb: ekspor CSV reservasi dan riwayat transaksi, email konfirmasi, iCal untuk blok tanggal.
- [x] Tiket.com dan Traveloka: email notifikasi dan ekspor extranet.
- [x] Penerimaan email: mailbox khusus atau inbound webhook, simpan email mentah.
- [x] Pemetaan listing ke unit (seed dan UI sederhana).

**Selesai bila:** tiap adapter lulus tes dengan minimal 5 fixture asli (termasuk pembatalan dan modifikasi), idempoten, dan setiap record bisa ditelusuri ke `import_batch`.

### Fase 3: Rekonsiliasi dan laporan
- [x] `commission_rule` per listing, alur estimasi ke aktual, tampilan selisih.
- [x] Kartu gross → komisi → pendapatan bersih berdampingan; tabel per OTA dan properti dengan kolom status data (estimasi/aktual).
- [x] Tab kas berdasarkan payout dan komisi terutang.
- [x] Alert bentrok jadwal.
- [x] Laporan bulanan pemilik (PDF dan Excel) dengan rincian per properti dan per OTA.

### Fase 4: Pengerasan dan rilis
- [x] Backup terjadwal ke penyimpanan terpisah dan uji restore.
- [x] Pemantauan dan alert kegagalan sinkronisasi.
- [x] Keamanan: hash password, rate limit, enkripsi backup, kebijakan retensi data tamu (UU PDP).
- [x] UAT dengan pemilik, deploy, dokumentasi dan serah terima.

## 9. Aturan untuk agent

1. **Jangan mengarang format email atau CSV OTA.** Tulis parser hanya terhadap fixture di `fixtures/real/`. Sebelum fixture asli ada, pakai `fixtures/synthetic/` dan beri label jelas.
2. Jangan scraping, jangan otomasi login extranet, jangan meminta kredensial OTA.
3. Jangan mengunci keputusan di bagian 4. Catat pertanyaan di `docs/DECISIONS.md` dan lanjutkan dengan default yang tertulis.
4. Semua angka keuangan wajib bertes. Perubahan rumus KPI harus memperbarui bagian 6 dan tesnya.
5. Koreksi data lewat entri pembalik, bukan edit atau hapus. Tulis log audit.
6. Selalu bedakan label estimasi dan aktual di UI.
7. PR kecil per tugas, satu tujuan per PR. Jangan menyentuh hosting atau pilihan database sebelum diputuskan.

## 10. Data yang dibutuhkan dari client (penghambat Fase 2 dan 3)

- Screenshot halaman depan extranet tiap OTA (nama dan ID properti) sebagai bukti akses.
- 3-5 contoh email notifikasi booking per OTA, termasuk pembatalan dan modifikasi.
- Contoh ekspor atau laporan dari extranet, dan riwayat booking 6-12 bulan.
- Daftar unit (nama, kapasitas, struktur harga) dan cara estate dijual sebagai paket.
- Komisi per OTA, model pembayaran (channel atau hotel collect), jadwal payout.
- Catatan pengeluaran 3-6 bulan terakhir, daftar biaya rutin bulanan dan tahunan, bagan akun akuntan jika ada.
- Ada tidaknya pemasukan non-OTA.

## 11. Backlog (di luar scope awal)

- Potongan tambahan di tampilan bersih (biaya pembayaran/channel, pajak, service charge): **hanya setelah diminta client**.
- Expedia Group dan Agoda sebagai adapter tambahan.
- Channel manager sebagai hub data (API/webhook) setelah client setuju.
- Website direct booking mengikuti referensi mjvilla.com.
- Revenue F&B/spa dan integrasi POS.
- Peran per properti, multi-tenant, laporan analitik OTA (visibilitas, konversi, skor ulasan, dicatat manual bila perlu).
