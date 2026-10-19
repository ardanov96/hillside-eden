# 08. Kualitas, Keamanan, Privasi, dan Operasional

## 1. Strategi pengujian

| Tingkat | Alat | Cakupan | Target |
|---|---|---|---|
| Unit | Vitest | `src/domain`, `lib/money`, `lib/dates`, util parser | Domain ≥ 90% baris/cabang |
| Property-based | fast-check | Alokasi (total selalu sama), pembulatan, pemisahan periode | Properti utama lulus 1.000+ kasus acak |
| Golden file | Vitest | Setiap adapter terhadap fixture + `*.expected.json` | 100% fixture lulus |
| Integrasi | Vitest + Postgres (docker) | Pipeline ingest, upsert idempoten, audit, penutupan periode | Alur utama di `03` §3 |
| E2E | Playwright | Login, input pengeluaran, impor CSV, ringkasan, tutup buku | Alur kritis hijau di CI |
| Performa | Skrip sintetis | Halaman Ringkasan pada data besar (S4-05) | Waktu muat wajar pada 50 ribu booking sintetis |

Aturan:
- Perhitungan keuangan **tanpa tes = tidak boleh digabung**.
- Kasus emas di `05` §9 wajib menjadi tes.
- Tes tidak boleh bergantung pada jam sistem; injeksi waktu dan zona.
- Seed dan generator dummy memakai benih tetap.

## 2. Gerbang CI

Lint, typecheck, unit/integrasi, `prisma validate`, `pnpm audit` (peringatan tinggi menggagalkan), cek migrasi (tidak ada perubahan skema tanpa berkas migrasi), build Docker. E2E dijalankan pada branch utama dan pada PR yang menyentuh UI atau pipeline.

## 3. Keamanan aplikasi

- **Autentikasi:** Auth.js credentials; password di-hash **argon2id**; sesi cookie `HttpOnly`, `Secure`, `SameSite=Lax`; batas laju dan penundaan progresif pada login; ganti password dan sesi kedaluwarsa.
- **Otorisasi:** semua route dan server action memeriksa sesi dan `organization_id`. Peran disiapkan, hanya `OWNER` aktif.
- **Validasi:** semua input lewat Zod di batas server (form, webhook, upload).
- **CSRF:** gunakan perlindungan bawaan Server Actions; endpoint webhook memakai tanda tangan/token rahasia.
- **Header:** CSP ketat, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`.
- **Unggahan:** batas ukuran, daftar tipe MIME yang diizinkan, pemeriksaan isi (bukan hanya ekstensi), nama berkas diacak, penyimpanan di luar webroot, tidak pernah dieksekusi.
- **Pengambilan iCal:** daftar putih domain, tolak IP privat/loopback (cegah SSRF), batas waktu dan ukuran respons. **URL iCal adalah rahasia**: simpan terenkripsi (`IcalFeed.urlEncrypted`), jangan masuk log.
- **Rahasia:** hanya lewat variabel lingkungan atau secret manager; `.env` tidak di-commit; rotasi bila bocor.
- **Dependensi:** lockfile, audit rutin, hindari rilis kurang dari 14 hari, tinjau paket baru sebelum ditambahkan.
- **Log:** pino terstruktur; **jangan mencatat** nama tamu, email, isi email mentah, atau URL rahasia.

## 4. Privasi data tamu

- **Prinsip minimisasi:** simpan hanya yang dibutuhkan untuk KPI. Default: nama tampilan/inisial dan negara; tanpa email, telepon, atau alamat (**OD-06**).
- **Retensi:** `Guest.retentionUntil` + job `retention.sweep` untuk menghapus atau menganonimkan data tamu setelah masa retensi yang disepakati dengan client.
- **Akses:** satu admin; semua akses data sensitif tercatat.
- **Fixture:** data asli dianonimkan sebelum masuk repo (lihat `06` §8). Email mentah `.eml` hanya di penyimpanan privat, tidak di repo.
- Pelindungan data pribadi diatur UU Pelindungan Data Pribadi (UU No. 27 Tahun 2022). Dokumen ini bukan nasihat hukum; kebijakan retensi dan dasar pemrosesan perlu ditinjau pihak yang kompeten bersama client.

## 5. Integritas data keuangan

- Entri terverifikasi tidak dapat diubah; koreksi lewat entri pembalik.
- `audit_log` untuk setiap perubahan pada booking manual, pengeluaran, pendapatan lain, aturan komisi, penutupan/pembukaan periode, dan pengaturan pemetaan.
- Penutupan periode menyimpan snapshot; selisih sesudahnya ditampilkan (lihat `05` §7).
- Rekonsiliasi: ringkasan memiliki pemeriksaan konsistensi (mis. jumlah alokasi unit = gross booking) yang dijalankan di CI dan sebagai pemeriksaan data berkala.

## 6. Lingkungan dan konfigurasi

| Lingkungan | Tujuan | Catatan |
|---|---|---|
| Lokal | Pengembangan | `docker compose`, data dummy |
| Staging | UAT dan demo | Data dummy atau data asli teranonimkan; domain terpisah |
| Produksi | Pemakaian pemilik | Akun/rahasia atas nama client bila memungkinkan |

Variabel lingkungan minimal (nama indikatif):
`DATABASE_URL`, `DIRECT_DATABASE_URL` (migrasi), `AUTH_SECRET`, `APP_BASE_URL`, `ENCRYPTION_KEY` (URL iCal), `STORAGE_DRIVER` dan kredensialnya, `INBOUND_EMAIL_*`, `SENTRY_DSN` (opsional), `TZ=Asia/Makassar` (untuk proses, namun logika tetap eksplisit zona).

Semua nilai divalidasi saat start (Zod pada `lib/env`); aplikasi menolak jalan bila konfigurasi tidak valid.

## 7. Migrasi database

- Perubahan skema melalui Prisma Migrate; migrasi ditinjau seperti kode.
- Pola **expand/contract**: tambah kolom/tabel baru → deploy kode yang menulis keduanya → migrasi data → hapus yang lama pada rilis berikutnya. Hindari perubahan yang merusak versi kode sebelumnya.
- Migrasi dijalankan lewat `prisma migrate deploy` pada langkah deploy, dengan koneksi langsung (non-pooling).
- Setiap migrasi destruktif wajib didahului backup yang diverifikasi.

## 8. Backup dan pemulihan

- Backup logis harian ke penyimpanan terpisah dari host database, terenkripsi; tambah PITR bila host mendukung (retensi bawaan sering pendek, jangan mengandalkannya saja).
- **Uji restore** terjadwal (minimal bulanan) ke lingkungan terpisah dan verifikasi ringkasan KPI cocok.
- Berkas unggahan (struk, email mentah) ikut dicadangkan.
- Dokumentasikan RPO/RTO yang disepakati dengan client (**OD-14**).

## 9. Pemantauan dan alert

| Sinyal | Alert bila |
|---|---|
| Health check `/api/health` | Gagal berturut-turut |
| Heartbeat worker | Tidak ada dalam beberapa menit |
| Item impor `FAILED` | Ada yang baru |
| Kegagalan job (iCal, email, template rutin) | Melebihi batas retry |
| Backup | Gagal atau terlambat |
| Ukuran antrean | Menumpuk tidak wajar |

Jangan mengalert "tidak ada booking baru" sebagai kesalahan: itu bisa wajar. Yang dialert adalah **kegagalan**, bukan sepinya data. Tampilkan kesegaran sumber di UI.

## 10. Runbook singkat

- **Memproses ulang batch:** buka Perlu perhatian → pilih item → proses ulang (idempoten). Dari CLI: `pnpm ingest:reprocess --batch <id>`.
- **Parser rusak karena format OTA berubah:** item masuk karantina; tambah fixture baru, tulis adapter versi baru (`v2`), proses ulang batch yang tertahan.
- **Salah pemetaan listing↔unit:** perbaiki di Pengaturan, jalankan `pnpm ingest:reallocate --listing <id>` untuk menghitung ulang alokasi; periode terkunci tidak berubah (selisih ditampilkan).
- **Rollback rilis:** deploy ulang image sebelumnya; migrasi expand/contract menjaga kompatibilitas. Jangan rollback skema tanpa backup terverifikasi.
- **Bocor rahasia:** rotasi `AUTH_SECRET`, `ENCRYPTION_KEY`, URL iCal baru dari Airbnb, kredensial penyimpanan dan email masuk.

## 11. Rilis dan dokumentasi

- Versi semantik dan `CHANGELOG.md`.
- Setiap rilis: tes hijau, migrasi diperiksa, catatan perubahan, tag.
- Serah terima (S8-05): panduan pemakaian untuk pemilik, panduan operasional untuk pengelola proyek, daftar akses dan akun, jadwal backup, kontak dan eskalasi.
