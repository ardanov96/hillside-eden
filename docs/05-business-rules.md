# 05. Aturan Bisnis dan KPI

Dokumen ini adalah sumber kebenaran untuk semua perhitungan. Perubahan rumus harus memperbarui dokumen ini **dan** tesnya.

## 1. Konvensi umum

- Mata uang dasar: **IDR**. Setiap nilai punya mata uang asli, kurs, dan nilai dasar (snapshot).
- Kurs: default diisi manual per bulan atau dari data payout aktual bila tersedia (**OD-08**). Beri label sumber kurs. Jangan memakai kurs "hari ini" untuk data historis.
- Pembulatan: hitung dengan presisi penuh, bulatkan 2 desimal **hanya saat menyimpan alokasi atau menampilkan**. Sisa pembulatan masuk ke elemen terakhir sehingga total selalu cocok.
- Basis tanggal: revenue dan okupansi = **tanggal menginap**; pace dan lead time = **tanggal booking dibuat**; kas = **tanggal payout**.
- Zona waktu: `Asia/Makassar`. Tanggal menginap bertipe `date` (tanpa zona).

## 2. KPI pemasukan

Definisi periode `P = [mulai, akhir]` (tanggal inklusif), properti `p` atau gabungan.

| KPI | Rumus |
|---|---|
| Malam terjual | Jumlah malam booking berstatus `CONFIRMED` pada unit yang `isSellable`, yang tanggal malamnya jatuh dalam `P` |
| Malam tersedia | Σ unit (`isSellable` pada hari itu) × jumlah hari dalam `P` |
| Okupansi | Malam terjual ÷ malam tersedia. Gabungan dihitung **total ÷ total** |
| Revenue kamar (gross) | Σ alokasi gross per malam untuk malam dalam `P` |
| ADR | Revenue kamar ÷ malam terjual |
| RevPAR | Revenue kamar ÷ malam tersedia |
| Lead time | `check_in − tanggal(bookedAt)` (hari), rata-rata atas booking yang dibuat dalam `P` |
| Tingkat pembatalan | Booking `CANCELLED` ÷ semua booking yang dibuat dalam `P` |
| Pace | Booking/revenue yang sudah masuk untuk periode menginap mendatang, dibanding periode sama tahun lalu pada titik waktu yang sama |

**Alokasi per malam:** gross booking dibagi rata per malam menginap. Sisa pembulatan masuk ke malam terakhir. Contoh: Rp 3.000.001 untuk 3 malam → 1.000.000 + 1.000.000 + 1.000.001.

**Booking yang melintasi periode:** hanya malam yang jatuh dalam `P` dihitung ke `P`.

## 3. Alokasi ke unit (listing gabungan/estate)

Booking di listing yang memetakan ke banyak unit dialokasikan ke `booking_unit` dengan bobot, urutan prioritas:
1. `ListingUnit.allocationWeight` bila ada;
2. `Unit.baseRate`;
3. `Unit.maxGuests`;
4. sama rata.

Nilai asli tetap di `Booking.grossAmount`; jumlah alokasi selalu sama dengan nilai asli. Booking estate **memblokir semua unit** anggotanya untuk deteksi bentrok. Default alokasi ini bisa diubah (**OD-07**).

## 4. Status booking dan perlakuan khusus

| Situasi | Perlakuan default (**OD-09** untuk konfirmasi) |
|---|---|
| `CONFIRMED` | Dihitung penuh |
| `PENDING` | Tidak dihitung ke revenue; tampil sebagai "menunggu" |
| `CANCELLED` tanpa biaya | Tidak dihitung ke malam maupun revenue |
| `CANCELLED` dengan biaya | Biaya dicatat di `cancellationFee`, diakui sebagai revenue pada tanggal check-in semula; **tidak** menambah malam terjual dan tidak masuk ADR |
| `NO_SHOW` | Diperlakukan seperti batal dengan biaya (biaya yang benar-benar ditahan) |
| Modifikasi tanggal/nilai | Keadaan terbaru berlaku; riwayat di `booking_event` |

## 5. Komisi, gross, dan net

- **Pendapatan bersih** = gross − komisi OTA. Label UI: "Pendapatan bersih (setelah komisi OTA)".
- Komisi per booking:
  1. Bila ada angka dari payout/laporan → `commissionBasis = ACTUAL`.
  2. Bila belum → hitung dari `CommissionRule` yang berlaku pada tanggal booking: `gross × rate`, `commissionBasis = ESTIMATED`.
  3. Input manual → `MANUAL`.
- Saat angka aktual masuk, ganti estimasi dan simpan selisih (aktual − estimasi) untuk rekonsiliasi.
- **Model pembayaran (`collectType`):**
  - `CHANNEL_COLLECT`: kas masuk = gross − komisi pada tanggal payout.
  - `HOTEL_COLLECT`: kas masuk = gross saat tamu membayar; komisi menjadi **komisi terutang** sampai dibayar/ditagih. Tampilkan saldo terutang per OTA.
  - `UNKNOWN`: tampilkan penanda "model pembayaran belum diketahui" dan jangan menarik kesimpulan kas.
- Pajak yang dipungut (`taxesCollected`) tidak termasuk gross dan tidak masuk revenue.
- Potongan tambahan lain di luar komisi **ditunda** sampai diminta client.

## 6. Pengeluaran dan hasil operasional

- Pengeluaran diakui pada `incurredOn`; kas keluar pada `paidOn`.
- Biaya per properti langsung ke properti; **biaya bersama** (`propertyId = null`) dialokasikan lewat `AllocationRule` (`FIXED_PERCENT` atau `ROOM_NIGHTS` terjual pada periode). Jumlah alokasi harus sama dengan nilai biaya.
- **Hasil operasional** = pendapatan bersih + pendapatan lain − pengeluaran. Belum termasuk pajak penghasilan, depresiasi, dan cicilan.
- Kategori default: gaji dan tunjangan; utilitas; housekeeping/laundry/amenities; makanan dan minuman; perawatan dan perbaikan; pemasaran dan software/platform; pajak, perizinan, asuransi; transportasi dan operasional lain; sewa/lease. Final disesuaikan dengan akuntan client (**OD-12**).
- Biaya tahunan (mis. asuransi) boleh disebar ke beberapa bulan lewat template; default: diakui saat terjadi.

## 7. Penutupan periode

1. Periode (bulan) dapat ditutup oleh owner. Syarat: tidak ada pengeluaran berstatus `DRAFT` pada periode itu (atau konfirmasi eksplisit).
2. Saat menutup, simpan **snapshot** KPI dan ringkasan keuangan di `PeriodLock.snapshot`.
3. Pada periode terkunci: entri manual (pengeluaran, pendapatan lain) tidak bisa dibuat/diubah; koreksi dilakukan di periode berjalan dengan keterangan.
4. Perubahan booking yang memengaruhi periode terkunci (mis. modifikasi terlambat) tetap diproses, tetapi UI menampilkan **"Selisih sejak penutupan"** antara angka hidup dan snapshot.
5. Pembukaan kembali periode hanya oleh owner dan dicatat di `audit_log`.

## 8. Deteksi bentrok

- Interval menginap `[check_in, check_out)` per unit. Dua booking `CONFIRMED` yang berbeda pada unit yang sama dengan interval beririsan adalah **bentrok**.
- Listing gabungan diperluas ke semua unit anggota sebelum perbandingan.
- `CalendarBlock` (iCal) ikut dibandingkan sebagai sumber tanggal terisi; bentrok dengan blok ditandai terpisah ("jadwal terisi tanpa data booking").
- Booking pada unit yang tidak `isSellable` pada tanggal itu menghasilkan peringatan, bukan bentrok.
- Hasil: `{unitId, bookingA, bookingB|blockId, overlapStart, overlapEnd, severity}`; dihitung saat dibaca dan memicu alert saat pertama muncul.

## 9. Contoh uji (golden cases)

1. Booking 3 malam Rp 3.000.001 → alokasi per malam 1.000.000 / 1.000.000 / 1.000.001.
2. Booking melintasi akhir bulan (check-in 30, check-out 3) → malam 30 dan 31 masuk bulan ini, 1-2 bulan berikut.
3. Estate 7 unit, gross Rp 14.000.000 dengan bobot sama → tiap unit 2.000.000; total sama.
4. Okupansi gabungan dua properti dengan ukuran berbeda ≠ rata-rata persentase.
5. Batal dengan biaya Rp 500.000 → revenue +500.000 pada tanggal check-in semula, malam terjual tidak bertambah.
6. Komisi estimasi 15% lalu aktual 14,2% → net berubah, selisih tercatat.
7. Hotel collect: gross Rp 2.000.000, komisi 15% → komisi terutang Rp 300.000 sampai dibayar.
8. Biaya bersama Rp 1.000.000 dengan alokasi 60/40 → 600.000 dan 400.000.
9. Periode terkunci menolak pengeluaran baru; modifikasi booking menampilkan "selisih sejak penutupan".
