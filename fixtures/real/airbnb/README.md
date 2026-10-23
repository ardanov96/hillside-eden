# Fixture Nyata Airbnb (fixtures/real/airbnb/)

Direktori ini disiapkan untuk menampung data **asli** hasil unduhan dari extranet Airbnb client setelah dianonimkan (AGENTS.md aturan 1).

## Berkas yang Diperlukan dari Extranet Airbnb:

1. **Ekspor CSV Reservasi (`csv/`)**:
   - Unduh dari: **Airbnb Host Extranet -> Reservations -> Export (CSV)**
   - Format penamaan: `reservations-YYYYMMDD.csv`
2. **Ekspor CSV Riwayat Transaksi / Payout (`csv/`)**:
   - Unduh dari: **Airbnb Host Extranet -> Earnings / Payouts -> Transaction History -> Export (CSV)**
   - Format penamaan: `payouts-YYYYMMDD.csv`
3. **Contoh Email Asli (`email/`)**:
   - Email konfirmasi booking baru: `confirmed-01.eml`
   - Email modifikasi/perubahan tanggal: `altered-01.eml`
   - Email pembatalan reservasi: `cancelled-01.eml`

## Kebijakan Privasi (WAJIB sebelum commit):
- Ganti/samarkan nama tamu dengan inisial (mis. "J. D.").
- Hapus/samarkan nomor telepon atau email pribadi tamu.
- Kode konfirmasi reservasi (mis. "HMXXXXXXXX") dan angka finansial (gross, komisi, payout) tetap dipertahankan untuk menguji akurasi parser.
