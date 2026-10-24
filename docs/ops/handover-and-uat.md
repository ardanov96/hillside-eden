# Panduan Serah Terima & Skenario UAT Pemilik (Handover & UAT Guide)

Dokumen ini merupakan panduan resmi serah terima sistem dan skenario pengujian penerimaan pengguna (*User Acceptance Testing*) bersama pemilik villa untuk **Hillside Eden & Ubud Hillside** (Sprint 8, tiket **S8-05**).

---

## 1. Skenario Pengujian Penerimaan Pengguna (UAT Checklist)

Skenario ini dirancang untuk dijalankan bersama pemilik properti guna memverifikasi kesesuaian sistem terhadap kebutuhan bisnis nyata:

### Skenario 1: Verifikasi Ringkasan Finansial Eksekutif (`/`)
* **Tujuan:** Memastikan pemilik dapat melihat pendapatan kotor, beban potongan komisi, pendapatan bersih, dan hasil operasional secara berdampingan.
* **Langkah:**
  1. Buka dashboard utama di `/`.
  2. Periksa kartu ringkasan atas: **Nilai Booking (Gross)** → **Komisi Saluran OTA** → **Pendapatan Bersih (setelah komisi OTA)** → **Beban Operasional** → **Hasil Operasional**.
  3. Ubah filter global di bilah atas: ganti properti dari "Semua Properti" ke "Hillside Eden" atau "Ubud Hillside".
  4. Ganti filter periode (Bulan Ini, Bulan Lalu, Tahun Berjalan).
* **Kriteria Sukses:**
  - Angka Gross, Komisi, dan Bersih selalu tampil berurutan dan transparan ([ADR-004](file:///c:/Dev/hillside-eden/docs/DECISIONS.md#L12)).
  - Tidak ada istilah "net income" atau "laba" yang menyesatkan ([ADR-009](file:///c:/Dev/hillside-eden/docs/DECISIONS.md#L17)).
  - Filter di URL memengaruhi seluruh visualisasi chart dan tabel.

### Skenario 2: Input & Pemantauan Reservasi Booking (`/bookings`)
* **Tujuan:** Memverifikasi alur pencatatan booking langsung/manual serta pencarian riwayat booking OTA.
* **Langkah:**
  1. Buka halaman `/bookings`.
  2. Cari reservasi berdasarkan kode konfirmasi atau nama tamu.
  3. Filter berdasarkan saluran (Airbnb, Tiket.com, Traveloka).
  4. Klik tombol **Input Booking Manual** (`/bookings/new`).
  5. Masukkan data tamu langsung, pilih unit/estate, tanggal menginap, dan nominal gross.
  6. Simpan formulir.
* **Kriteria Sukses:**
  - Booking manual masuk secara idempoten dan langsung tercermin di daftar reservasi dan KPI dashboard.
  - Perubahan tanggal atau status tercatat di riwayat kejadian (`BookingEvent`).

### Skenario 3: Manajemen Kas & Rekonsiliasi Komisi OTA (`/cash`)
* **Tujuan:** Memantau arus kas aktual masuk/keluar serta memeriksa saldo komisi terutang hotel collect.
* **Langkah:**
  1. Buka halaman `/cash`.
  2. Tab **Arus Kas Masuk & Keluar**: Periksa total payout yang sudah cair, penerimaan hotel collect, dan pengeluaran kas.
  3. Periksa kartu **Komisi Terutang (Hotel Collect)**: Periksa saldo komisi yang harus disetor ke OTA.
  4. Tab **Rekonsiliasi Komisi**: Bandingkan komisi estimasi kontrak awal vs komisi aktual payout nyata.
  5. Tab **Aturan Komisi**: Tambah/ubah aturan rate komisi per saluran.
* **Kriteria Sukses:**
  - Pemilik mengetahui persis kas yang sudah cair vs pendapatan yang belum ditransfer oleh OTA.
  - Saldo komisi terutang hotel collect terpisah jelas dari channel collect.

### Skenario 4: Penerbitan Laporan Bulanan Pemilik (`/reports`)
* **Tujuan:** Mengunduh berkas laporan bulanan resmi untuk arsip akuntansi dan perpajakan pemilik.
* **Langkah:**
  1. Buka halaman `/reports`.
  2. Pilih bulan dan tahun laporan (misal: Oktober 2026).
  3. Klik tombol **Unduh Excel**: Buka file `.csv` yang diunduh di Microsoft Excel.
  4. Klik tombol **Cetak / PDF**: Buka tampilan pratinjau cetak A4 resmi berkop surat Hillside Eden.
* **Kriteria Sukses:**
  - File Excel terbuka rapi dengan pemisah kolom yang pas dan metadata lengkap.
  - Tampilan cetak memuat kop surat resmi, tabel data per saluran OTA, beban operasional per kategori, dan kolom tanda tangan pengesahan.

### Skenario 5: Penutupan Buku Bulanan & Variansi Pasca-Tutup
* **Tujuan:** Mengunci laporan bulanan agar data historis tidak berubah tanpa jejak audit.
* **Langkah:**
  1. Di halaman `/reports`, klik tab **Kelola Tutup Buku Bulanan**.
  2. Pilih bulan yang ingin ditutup, klik **Tutup Buku Bulan Ini**.
  3. Konfirmasi modal snapshot angka.
  4. Setelah buku terkunci, coba buka kembali buku dengan memasukkan alasan pembukaan kembali.
* **Kriteria Sukses:**
  - Status buku berubah menjadi "Terkunci" dengan badge hijau.
  - Setiap pembukaan kembali mencatat aktor, waktu, dan alasan ke `AuditLog`.

---

## 2. Checklist Serah Terima Produksi (Handover Checklist)

| No | Komponen Serah Terima | Detail |
|---|---|---|
| 1 | **Akses Kode Sumber** | Repository GitHub: `https://github.com/ardanov96/hillside-eden.git` (branch `main`). |
| 2 | **Database Produksi** | Host: Neon PostgreSQL (`ap-southeast-1` Singapore). Akses aman via `DATABASE_URL` dan `DIRECT_DATABASE_URL`. |
| 3 | **Akun Pengguna Admin** | Peran `OWNER` terdaftar di database, password di-hash dengan standar Argon2id. |
| 4 | **SOP Cadangan & Restore** | Terdokumentasi di [`docs/ops/backup-restore.md`](file:///c:/Dev/hillside-eden/docs/ops/backup-restore.md). |
| 5 | **Panduan Keamanan** | Terdokumentasi di [`docs/ops/security-hardening.md`](file:///c:/Dev/hillside-eden/docs/ops/security-hardening.md). |
| 6 | **Prosedur Intake Data Nyata** | Saat client memberikan contoh file asli extranet, simpan di `fixtures/real/` sesuai panduan di masing-masing folder. |

---

## 3. Kontak Dukungan & Pemeliharaan

* **Pengelola Proyek:** BaliHoster (Freelance Development)
* **Kerahasiaan Data:** Sistem tidak menyimpan nomor kartu kredit tamu, token login extranet, atau data rahasia perbankan. Seluruh akses menggunakan protokol HTTPS aman dan enkripsi end-to-end.
