# 07. Spesifikasi UI

Bahasa antarmuka: **Indonesia**. Format: mata uang `Rp 1.500.000`, tanggal `19 Okt 2026`, zona WITA. Desain mobile-first untuk form pengeluaran; dashboard utama dioptimalkan untuk desktop namun harus terbaca di ponsel.

## 1. Teks baku (copy deck)

| Konsep | Teks UI |
|---|---|
| Gross | Nilai booking (gross) |
| Komisi | Komisi OTA |
| Net | **Pendapatan bersih (setelah komisi OTA)** |
| Hasil | **Hasil operasional** |
| Estimasi | Badge "Estimasi" (kuning) |
| Aktual | Badge "Aktual" (hijau) |
| Model bayar | Channel collect / Hotel collect / Belum diketahui |
| Komisi terutang | Komisi terutang ke OTA |
| Perlu ditinjau | Perlu perhatian |
| Penutupan | Tutup buku bulan ini |
| Selisih pasca-tutup | Selisih sejak penutupan |

Jangan memakai istilah "net income" atau "laba" untuk angka mana pun.

## 2. Navigasi

Ringkasan · Booking · Kalender · Pengeluaran · Kas · Laporan · Perlu perhatian · Pengaturan.
Filter global di bilah atas: **Properti** (Semua properti / tiap properti) dan **Periode** (bulan ini, bulan lalu, tahun berjalan, kustom). Filter bertahan antar halaman.

## 3. Halaman

### 3.1 Ringkasan
- Baris kartu: Nilai booking (gross) → Komisi OTA → **Pendapatan bersih** (berdampingan, dengan persentase komisi efektif) → Pengeluaran → **Hasil operasional**.
- Baris KPI: Okupansi, ADR, RevPAR, jumlah booking, tingkat pembatalan.
- Grafik batang bulanan: pendapatan bersih vs pengeluaran, garis hasil operasional.
- Tabel "Per OTA": gross, komisi, % efektif, bersih, jumlah booking, **status data** (Estimasi/Aktual).
- Tabel "Per properti" (saat filter = semua).
- Lencana **kesegaran data** per sumber: nama sumber, waktu sinkron terakhir, jumlah item "perlu perhatian".
- Bila ada bentrok jadwal: banner peringatan dengan tautan ke Kalender.
- Setiap angka bergantung data tidak lengkap memiliki ikon info dengan penjelasan singkat.

### 3.2 Booking
Tabel dengan filter (OTA, properti, status, rentang tanggal menginap/booking), pencarian kode konfirmasi. Baris membuka panel detail: ringkasan, alokasi unit, komisi (estimasi/aktual), **riwayat perubahan** (`booking_event`), tautan ke item impor asal.

### 3.3 Kalender
Garis waktu per unit (baris = unit, kolom = hari), blok booking berwarna per OTA, `CalendarBlock` sebagai blok abu-abu bergaris, bentrok ditandai merah. Unit yang tidak dijual pada tanggal tertentu diberi arsiran.

### 3.4 Pengeluaran
Daftar dengan filter (properti, kategori, status, periode). Form tambah: tanggal, kategori, jumlah, properti atau "biaya bersama", vendor, keterangan, metode bayar, unggah foto struk. Tab: **Template rutin**, **Impor CSV**, **Pendapatan lain**. Status Draf/Terverifikasi tampil jelas; entri terverifikasi hanya punya aksi "Koreksi" (membuat entri pembalik).

### 3.5 Kas
Kas masuk berdasarkan tanggal payout per OTA; kas keluar berdasarkan tanggal bayar; **komisi terutang** per OTA; selisih "pendapatan sudah terjadi tapi belum cair".

### 3.6 Laporan
Pembuat laporan bulanan (pilih periode, properti, unduh PDF/Excel). Bagian **Tutup buku**: daftar periode, status, tombol tutup (dengan daftar syarat yang belum terpenuhi), tampilan snapshot.

### 3.7 Perlu perhatian
Kotak masuk untuk item impor `FAILED` dan `NEEDS_REVIEW`: lihat input mentah, penyebab, aksi (petakan listing, perbaiki, proses ulang, abaikan dengan alasan).

### 3.8 Pengaturan
Properti dan unit; listing OTA dan pemetaan listing↔unit; konfigurasi inventori (dijual/tidak per rentang tanggal); aturan komisi; aturan alokasi biaya bersama; kategori pengeluaran; profil pemetaan CSV; feed iCal; akun pengguna (satu admin).

## 4. Pola komponen

- **Badge status data**: Estimasi / Aktual / Belum lengkap.
- **Angka berpasangan**: gross dan net selalu ditampilkan bersama dan berurutan.
- **Panel detail** (drawer) untuk booking dan item impor.
- **Tabel**: urut kolom, sticky header, ekspor CSV, kosong/error/loading konsisten.
- **Konfirmasi aksi sensitif**: tutup buku, buka kembali periode, koreksi data terverifikasi.

## 5. Status UI

Setiap halaman wajib punya: loading (skeleton), kosong (dengan petunjuk langkah berikutnya), error (pesan dan coba lagi), dan data parsial (penanda eksplisit).

## 6. Aksesibilitas dan kualitas

- Kontras warna memadai; badge tidak hanya mengandalkan warna (sertakan teks/ikon).
- Navigasi keyboard untuk tabel dan dialog; label form terhubung.
- Target sentuh ≥ 44 px pada form mobile.
- Angka dan tanggal diformat `id-ID` konsisten melalui satu util.

## 7. Auto-refresh

Halaman Ringkasan, Booking, dan Perlu perhatian menyegarkan data tiap 30-60 detik dan menampilkan "Diperbarui X menit lalu". Jangan menyiratkan realtime untuk sumber yang bergantung email atau ekspor.
