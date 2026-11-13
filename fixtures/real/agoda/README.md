# Fixture Nyata Agoda (fixtures/real/agoda/)

Direktori ini menampung data **asli** hasil unduhan dari Agoda Partner Portal / YCS Extranet setelah dianonimkan (AGENTS.md aturan 1).

## Cara mengunduh (hanya lewat menu resmi, tanpa scraping)

1. Masuk ke **Agoda Partner Portal** (`ycs.agoda.com`).
2. Menu **Reservasi** -> atur filter tanggal -> **Ekspor CSV**.
   - Nama berkas: `booking-report-<idProperti>-<timestamp>_<hash>.csv`
   - Kolom yang diekspor **bergantung filter yang dipilih pengguna**, jadi fixture di
     bawah sengaja mencakup beberapa kombinasi kolom.
3. Menu **Analitik** -> "Unduh sebagai CSV" berisi data agregat, **bukan** data reservasi;
   berkas seperti itu tidak bisa diimpor sebagai booking.

## Isi direktori

| Berkas | Kombinasi kolom | Sumber |
|---|---|---|
| `csv/booking-report-agoda-homes-sample.csv` | 9 kolom (Partner Portal ringkas, tanggal `MM/DD/YYYY`) | Ekspor riil 2026-11-12 |
| `csv/booking-report-agoda-homes-cancelled.csv` | 26 kolom (Partner Portal rinci, tanggal ISO) | Ekspor riil 2026-11-12 |
| `csv/booking-report-agoda-homes-filtered.csv` | 10 kolom (subset dari ekspor 26 kolom) | Ekspor riil 2026-11-12 |

Setiap berkas CSV punya pasangan `*.expected.json` (hasil parse yang benar) untuk tes golden file.

## Kebijakan Privasi (WAJIB sebelum commit)

- Nama tamu disamarkan menjadi inisial (mis. "G. L. Loprang").
- Kode reservasi (mis. `2064191544`), ID listing Agoda (`1388437228`), tanggal, dan angka
  finansial tetap dipertahankan agar akurasi parser tetap teruji.
- `Acknowledgement_ID` dibiarkan kosong bila berisi data yang tidak relevan.
