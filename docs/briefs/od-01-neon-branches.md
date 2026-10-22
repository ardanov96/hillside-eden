# Brief: OD-01 - Neon Branching untuk dev lokal dan produksi (Free plan)

| Field | Nilai |
|---|---|
| Status | Siap dieksekusi |
| Tanggal | 2026-10-22 |
| Referensi keputusan | `docs/DECISIONS.md` OD-01 (Open) ditutup menjadi ADR-014 |
| Preset | Neon **Free plan** untuk dev dan prod, region `aws-ap-southeast-1` |
| Bentuk | Brief mandiri - agen lain cukup membaca `AGENTS.md` dan brief ini |
| Perubahan kode aplikasi | 1 blok di `prisma/schema.prisma`. **Tidak ada dependency baru.** |

> Dokumen ini adalah instruksi kerja, bukan catatan. Ikuti urutan, jangan lompat.

---

## 1. Masalah yang diselesaikan

Pengembangan lokal bergantung pada Docker Desktop yang harus hidup sebelum `pnpm dev`. Ketika daemon mati, `DATABASE_URL` (`localhost:5433`) tidak terjangkau, seluruh `prisma.user.findUnique` timeout, dan login lokal gagal.

Solusi: pindahkan Postgres ke **Neon** dan pakai fitur **branching** - satu project, banyak environment terisolasi. Ini sekaligus **menutup OD-01** (hosting database), yang selama ini menahan `directUrl` di skema.

**Tetap agnostik hosting** (AGENTS.md aturan 8): Neon hanya menyuplai `DATABASE_URL` lewat environment variable. `docker-compose.yml` **tidak dihapus**, tetap menjadi jalur fallback offline dan CI.

## 2. Keputusan yang SUDAH diambil - jangan dibahas ulang

1. Hosting database = **Neon**.
2. Plan = **Free** untuk dev dan prod, sampai ada data klien nyata.
3. Region = **`aws-ap-southeast-1`** (AWS Asia Pacific / Singapore).
4. Topologi branch: `main` = produksi, `dev` = lokal, `shadow` = opsional.
5. Prisma **tetap versi 6** dengan `directUrl`. **Jangan** naik ke Prisma 7 dan **jangan** memasang `@prisma/adapter-neon` atau `@neondatabase/serverless`.

## 3. Fakta platform yang melandasi keputusan

| Fakta | Nilai | Dampak ke pekerjaan |
|---|---|---|
| Region | Fix saat project dibuat, **tidak bisa diubah** | Salah pilih = tidak bisa pindah |
| Scale-to-zero | Compute tidur setelah **5 menit** idle | Perlu `connect_timeout=15` |
| History window (Free) | **6 jam** | Instant restore praktis tak berguna |
| Penghapusan | Project Free **idle 90 hari atau lebih akan dihapus**, aktif sejak 5 Okt 2026 | Boleh selama prod kosong. **Wajib** naik plan sebelum data klien masuk |
| Branch di luar kuota | $1.50 per branch-month (sekitar $0.002/jam) | Reset berkala = hampir gratis |
| Launch (nanti) | sekitar $15/bulan, history sampai 7 hari | Target saat data klien masuk |
| Latensi Bali ke Singapore | sekitar 40-80 ms RTT per query | Diterima, beban 1 user |

## 4. Prasyarat - wajib dikerjakan pemilik proyek

Bagian ini **tidak boleh** dikerjakan agen, dan kredensial **tidak boleh** muncul di chat (AGENTS.md aturan 9).

1. Daftar di <https://console.neon.com>, buat project `hillside-eden`.
2. Pilih region **AWS Asia Pacific (Singapore)** saat project dibuat.
3. Buat branch `dev` sebagai child dari `main`. Opsional: buat branch `shadow`.
4. Dari tab **Connect**, salin 2 connection string ke `.env` lokal:

```bash
# App runtime - endpoint POOLED (host mengandung "-pooler")
DATABASE_URL=postgresql://USER:PASS@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/hillside_eden?sslmode=require&connection_limit=5&pool_timeout=15&connect_timeout=15

# Prisma CLI (migrate/studio/introspect) - endpoint DIRECT (tanpa "-pooler")
DIRECT_DATABASE_URL=postgresql://USER:PASS@ep-xxx.ap-southeast-1.aws.neon.tech/hillside_eden?sslmode=require&connect_timeout=15
```

**Ganti `USER` dan `PASS` dengan kredensial asli secara manual.** Jangan tempelkan ke chat, jangan commit.

`connect_timeout=15` wajib karena scale-to-zero butuh beberapa detik untuk bangun, dan default timeout Prisma terlalu pendek.

## 5. Sanity check prasyarat (wajib, sebelum ubah kode)

```powershell
# Hostname Neon tidak mengandung nama branch, jadi jangan andalkan pencocokan nama.
# Yang diperiksa: host dapat dijangkau dan mengembalikan satu baris.
node -e "const{Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL});c.connect().then(()=>c.query('select 1')).then(r=>{console.log('OK',r.rows);return c.end()}).catch(e=>{console.error('FAIL',e.message);process.exit(1)})"
```

Kalau gagal: **berhenti** dan laporkan. Kemungkinan besar project suspended (buka Console lalu Resume) atau region salah pilih.

## 6. Langkah eksekusi

### Langkah 0 - Tutup artefak yang menggantung (sudah diverifikasi)

`prisma/migrations/20261020203446_booking_event_unique_per_type_time/migration.sql` sudah kehilangan BOM-nya (bagus, itu memang perbaikannya) tetapi kehilangan **newline akhir**. Isi SQL-nya utuh: commit `8b9b7ad` memang hanya berisi satu statement `ALTER TABLE`.

```powershell
git --no-pager diff -- 'prisma/migrations/20261020203446_booking_event_unique_per_type_time/migration.sql'
```

Perbaikan: tambahkan newline akhir tanpa mengembalikan BOM.

```powershell
$p = 'prisma/migrations/20261020203446_booking_event_unique_per_type_time/migration.sql'
$txt = [IO.File]::ReadAllText($p)
[IO.File]::WriteAllText($p, $txt.TrimEnd("`r","`n") + "`n", (New-Object System.Text.UTF8Encoding $false))
```

Verifikasi byte 0 harus `41` (huruf `A`), **bukan** `EF`:

```powershell
Format-Hex $p | Select-Object -First 1
```

Diff akhir harus tetap hanya menghapus BOM, tanpa mengubah isi. **Jangan pernah** menulis ulang berkas di `prisma/migrations/` tanpa `git show` lebih dulu (OD-23).

### Langkah 1 - `prisma/schema.prisma` (satu-satunya perubahan kode aplikasi)

Blok `datasource` saat ini (line 15-20) masih mengabaikan `directUrl` karena OD-01 belum diputuskan. Ganti dengan:

```prisma
datasource db {
  provider  = "postgresql"
  // App runtime: endpoint POOLED Neon (host mengandung "-pooler"). Lihat ADR-014.
  url       = env("DATABASE_URL")
  // Prisma CLI (migrate/studio/introspect): endpoint DIRECT Neon (tanpa "-pooler").
  // Wajib ada di semua environment, termasuk `prisma validate` di CI.
  directUrl = env("DIRECT_DATABASE_URL")
}
```

> Jangan aktifkan `shadowDatabaseUrl` sekarang. `prisma migrate dev` memang butuh shadow database, tetapi saat itu arahkan lewat variabel terpisah, jangan hardcode.

Tidak ada perubahan lain di kode aplikasi. `src/lib/env.ts:14` sudah mendeklarasikan `DIRECT_DATABASE_URL`, dan `src/lib/prisma.ts` tidak perlu disentuh.

### Langkah 2 - `.gitignore` dan `.env.example` (bug lama yang jadi blocker)

Temuan: `.env.example` **pernah tidak ter-commit** karena `.gitignore:34` (`.env*`) menutupinya, sementara `.github/workflows/ci.yml:73` menjalankan `cp .env.example .env`. Job `prisma-validate` **sudah rusak** sejak awal. Setelah `directUrl` aktif, job itu jadi wajib rusak karena `DIRECT_DATABASE_URL` tidak ada.

Di `.gitignore`, tambahkan **tepat setelah** baris `.env*`:

```gitignore
# env files (can opt-in for committing if needed)
.env*
!.env.example
```

Lalu `git add -f .env.example` dan isi ulang memakai URL Neon **placeholder**, tanpa kredensial asli:

```bash
# --- Database (Neon) ---
# App runtime: endpoint pooled (host mengandung "-pooler").
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/hillside_eden?sslmode=require&connection_limit=5&pool_timeout=15&connect_timeout=15
# Prisma CLI (migrate/studio): endpoint direct, tanpa "-pooler".
DIRECT_DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/hillside_eden?sslmode=require&connect_timeout=15

# --- Fallback Docker lokal (opsional) ---
# Bila Neon tak terjangkau dan Docker hidup, ganti kedua URL di atas dengan:
#   postgresql://hillside:hillside@localhost:5433/hillside_eden?schema=public
```

Jaga agar struktur `.env.example` yang sudah ada (Aplikasi, Auth.js, Owner, Enkripsi, Penyimpanan, Email, Worker) tetap utuh.

### Langkah 3 - `prisma/seed-dummy.ts`: guardrail anti salah-tujuan

Setelah pindah ke Neon, `pnpm db:seed:dummy` bisa menunjuk database cloud. Tambahkan penolak **di paling atas skrip**, sebelum `PrismaClient` dipakai:

```ts
/**
 * Guard: skrip ini menulis ke database yang sedang aktif. Tolak jalan bila
 * menunjuk produksi. Lihat docs/briefs/od-01-neon-branches.md bagian 6.
 */
function assertDummyTargetIsSafe(): void {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const isProductionEnv = process.env.NODE_ENV === "production";
  const isKnownProd = Boolean(process.env.PROD_DATABASE_URL) && dbUrl === process.env.PROD_DATABASE_URL;
  if (isProductionEnv || isKnownProd) {
    console.error("[seed-dummy] DITOLAK: target dianggap produksi.");
    if (isProductionEnv) console.error("  Alasan: NODE_ENV=production.");
    if (isKnownProd) console.error("  Alasan: DATABASE_URL sama dengan PROD_DATABASE_URL.");
    process.exit(1);
  }
  const host = (() => {
    try {
      return new URL(dbUrl).host;
    } catch {
      return "(tidak terbaca)";
    }
  })();
  console.warn(`[seed-dummy] Menulis ke host: ${host}. Pastikan ini branch dev.`);
}

assertDummyTargetIsSafe();
```

Catatan desain: **nama branch tidak pernah muncul di hostname Neon**, jadi deteksi berdasarkan nama tidak mungkin dilakukan. Karena itu andalkan dua sinyal yang memang tersedia: `NODE_ENV` dan perbandingan dengan `PROD_DATABASE_URL`.

Set `PROD_DATABASE_URL` di environment produksi agar proteksi kedua aktif, dan perbarui juga blok komentar "Cara pakai" di header berkas.

### Langkah 4 - `docs/DECISIONS.md`

a) **Tutup OD-01.** Tambahkan ke bagian **A. Keputusan final**:

```
| ADR-014 | Hosting database: **Neon PostgreSQL**, region `aws-ap-southeast-1` (Singapore), plan Free sampai ada data klien nyata. Branch: `main`=produksi, `dev`=lokal, `shadow` opsional. Akses lewat `DATABASE_URL` (pooled) dan `DIRECT_DATABASE_URL` (direct) | Satu project dengan banyak environment terisolasi; branch bisa di-reset instan. Region paling dekat dengan Bali. `docker-compose.yml` tetap sebagai fallback offline dan CI. Lihat `docs/briefs/od-01-neon-branches.md` | Deploy, pooling, backup, `directUrl` di schema.prisma |
```

Hapus baris OD-01 dari bagian B. Riwayat tetap terjaga karena isinya pindah ke ADR-014.

b) Tambah di bagian B (Open):

```
| OD-24 | Kapan naik dari Neon Free ke Launch? | **Naik ke Launch (sekitar $15/bulan) sebelum data klien nyata masuk ke branch `main`.** Free plan menghapus project yang idle 90 hari atau lebih (aktif sejak 5 Okt 2026) dan history window hanya 6 jam | Keamanan data produksi, kemampuan restore |
```

c) Revisi **OD-23** yang masih uncommitted: Docker daemon tidak lagi prasyarat `pnpm dev` karena jalur utama adalah Neon, tetapi aturan **BOM-free untuk `*.sql` tetap berlaku**.

### Langkah 5 - Docs pendukung

| Berkas | Perubahan |
|---|---|
| `README.md` | Prasyarat: Docker jadi **opsional**. Setup lokal pakai Neon. Tandai `docker compose up -d` sebagai fallback pada tabel perintah. |
| `docs/03-architecture.md` | Bagian 1: ganti blok `PostgreSQL` menjadi `Neon (branch dev / main)`. Tambah catatan bahwa database bersifat stateless dan dikonfigurasi lewat env. |
| `docs/08-quality-security-ops.md` | Bagian 6: tabel lingkungan, "Lokal" kini branch `dev` Neon. Paragraf env var: jelaskan perbedaan `DATABASE_URL` (pooled) dan `DIRECT_DATABASE_URL` (direct, wajib untuk Prisma CLI). Bagian 7: tegaskan migrasi selalu lewat koneksi direct. |
| `docs/README.md` | Tambah baris indeks untuk folder `briefs/`. |
| `docker-compose.yml` | Komentar header: jalur **fallback** (offline, CI, migrasi cepat), bukan jalur utama. |

### Langkah 6 - Verifikasi

```powershell
pnpm db:generate
pnpm db:deploy        # prisma migrate deploy ke branch dev
pnpm db:seed

pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

Lalu jalankan `pnpm dev` dan lakukan smoke test login end-to-end: `/api/auth/csrf` lalu `/api/auth/callback/credentials` lalu `/api/auth/session`. Harus mengembalikan JSON yang memuat email owner.

**Uji wajib - interactive transaction.** `src/server/prisma-tx.ts:101` memakai `prisma.$transaction(fn, ...)` dalam bentuk interaktif, bukan `$transaction([...])`. Ini yang paling rawan terhadap PgBouncer pooler dan menyentuh **pipeline keuangan**. Jalankan satu ingest nyata terhadap branch `dev` dan pastikan commit berhasil.

### Langkah 7 - Commit

Satu tiket per commit (AGENTS.md). Usulan Conventional Commits:

```
chore(infra): tutup OD-01, Neon branching untuk dev dan prod
```

## 7. Definition of Done

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` hijau.
- [ ] `.env.example` ter-commit dan job `prisma-validate` di CI hijau.
- [ ] `prisma/schema.prisma` memakai `directUrl` dan `prisma validate` lolos.
- [ ] `pnpm db:deploy` dan `pnpm db:seed` sukses terhadap branch `dev`.
- [ ] Smoke test login end-to-end berhasil.
- [ ] Uji interactive transaction pada `withTransactionRetry` berhasil.
- [ ] `docs/DECISIONS.md`: OD-01 ditutup (ADR-014), OD-24 tercatat, OD-23 direvisi.
- [ ] Tidak ada kredensial nyata di repo, `.env.example`, atau pesan commit.
- [ ] Tidak ada TODO tanpa tiket.

## 8. Batasan keras - jangan dilanggar

- **Jangan** meminta atau menampilkan kredensial Neon di chat, issue, atau commit (aturan 9).
- **Jangan** menjalankan `pnpm db:deploy` atau `pnpm db:seed` terhadap branch `main` (produksi) tanpa konfirmasi eksplisit pemilik proyek.
- **Jangan** menghapus `docker-compose.yml` maupun alur migrasi lokal.
- **Jangan** memasang `@neondatabase/serverless`, `@prisma/adapter-neon`, atau `@types/pg`. Semuanya tidak dibutuhkan pada Prisma 6 dengan `directUrl`.
- **Jangan** naik ke Prisma 7 (butuh `prisma.config.ts` dan mengubah semua import client).
- **Jangan** memakai `pgbouncer=true` pada `DATABASE_URL`. Itu mematikan prepared statement dan dokumentasi Neon terkini tidak endorsenya.
- **Jangan** lupa `sslmode=require` pada kedua URL.
- **Jangan** mengubah keputusan lain di bagian B `docs/DECISIONS.md`.

## 9. Kalau ada masalah

| Gejala | Tindakan |
|---|---|
| `Can't reach database server` | Project suspended, buka Console lalu Resume. Project Free juga bisa terhapus bila idle 90 hari atau lebih. |
| Timeout saat query pertama | `connect_timeout=15` belum terpasang di `DATABASE_URL`. |
| `P1001` saat `prisma migrate dev` | Butuh shadow database. Jalankan terhadap Postgres lokal (`docker compose up -d postgres`) untuk **membuat** migration, lalu `db:deploy` ke branch dev. |
| Interactive transaction gagal di pooler | Opsi berurutan: (1) set `connection_limit=1`, (2) tambahkan `pgbouncer=true`, (3) arahkan proses ingest ke `DIRECT_DATABASE_URL`. Catat pilihan akhirnya di ADR baru. |
| `prisma validate` gagal di CI | `.env.example` belum ter-commit, atau `DIRECT_DATABASE_URL` belum ada di dalamnya. |
| Error `LTER` saat migrate | BOM UTF-8 di berkas `.sql` (OD-23). Periksa byte 0 dengan `Format-Hex`. |

## 10. Referensi

- Keputusan: `docs/DECISIONS.md` (OD-01, OD-16, OD-23, OD-24), `AGENTS.md`, `ROADMAP.md`
- Dokumen teknis: `docs/02-tech-stack.md`, `docs/03-architecture.md`, `docs/04-data-model.md`, `docs/08-quality-security-ops.md`
- Kode terkait: `prisma/schema.prisma`, `src/lib/env.ts`, `src/lib/prisma.ts`, `src/server/prisma-tx.ts`, `prisma/seed.ts`, `prisma/seed-dummy.ts`, `.github/workflows/ci.yml`, `docker-compose.yml`, `.env.example`