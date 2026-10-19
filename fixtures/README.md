# Fixtures (Data Uji untuk Adapter)

Direktori ini menyimpan data uji untuk parser dan adapter.

## Struktur

- `fixtures/real/` — data **asli** dari client/OTA (sudah dianonimkan)
- `fixtures/synthetic/` — data **sintetis** berlabel untuk pengembangan

## Kebijakan Anonimisasi (WAJIB)

Sebelum fixture asli masuk repo:

1. **Hapus/ganti** nama tamu, email, telepon, alamat — gunakan inisial/fake.
2. **Pertahankan** kode konfirmasi, tanggal, dan angka (tidak mengidentifikasi orang).
3. **Email mentah `.eml`** TIDAK boleh masuk repo. Simpan di penyimpanan privat.
4. Setiap fixture punya `*.expected.json` (golden file) hasil parse yang benar.

> Lihat `docs/06-ingestion-and-adapters.md` §8 dan `docs/08-quality-security-ops.md` §4.
