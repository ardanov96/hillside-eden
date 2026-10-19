# 02. Tech Stack

Prinsip: **stack yang sudah dikuasai pengembang, sedikit komponen infrastruktur, agnostik hosting.** Versi tidak dikunci di dokumen ini; pin versi tepat di `package.json` dan `.nvmrc` saat Sprint 0, dan pilih rilis stabil yang sudah beredar lebih dari 14 hari.

## 1. Inti

| Lapisan | Pilihan | Alasan | Catatan |
|---|---|---|---|
| Runtime | Node.js LTS aktif | Stabil, selaras stack pengembang | Pin di `.nvmrc` |
| Bahasa | TypeScript (`strict`) | Keamanan tipe untuk logika uang | `noUncheckedIndexedAccess` aktif |
| Web | Next.js (App Router) + React | Satu basis kode untuk UI dan API | Server Actions untuk form, Route Handlers untuk webhook |
| Database | PostgreSQL | Relasional, `DATE`/`timestamptz`, `jsonb`, view | **Host belum diputuskan (OD-01)** |
| ORM | Prisma | CRUD dan migrasi | Query laporan memakai SQL mentah/view |
| Validasi | Zod | Satu skema untuk form, API, parser | Dipakai juga di batas adapter |
| Auth | Auth.js (credentials) | Cukup untuk satu admin | Hash password argon2id |
| Paket | pnpm | Cepat, lockfile ketat | |

## 2. UI

| Kebutuhan | Pilihan |
|---|---|
| Styling | Tailwind CSS |
| Komponen | shadcn/ui |
| Tabel | TanStack Table |
| Grafik | Recharts |
| Form | React Hook Form + Zod |
| Data klien | TanStack Query (refresh berkala untuk "near-realtime") |
| Tanggal | date-fns + date-fns-tz (zona `Asia/Makassar`) |
| Uang | Prisma `Decimal` / decimal.js, format `id-ID` |

## 3. Ingest dan berkas

| Kebutuhan | Pilihan |
|---|---|
| Parsing email | `mailparser` + `cheerio` (HTML) |
| CSV | `csv-parse` atau `papaparse` |
| Excel (baca/tulis) | `exceljs` |
| iCal | `node-ical` |
| PDF laporan | `@react-pdf/renderer` atau cetak HTML lewat Playwright (putuskan di S8-01) |
| Penyimpanan berkas | Antarmuka `StorageProvider`: disk lokal untuk dev, S3-kompatibel untuk produksi (**OD-05**) |
| Email masuk | Antarmuka `InboundEmailSource`: webhook penyedia email atau poller IMAP (**OD-04**) |

## 4. Antrean dan penjadwal (bergantung hosting)

- **Default: `pg-boss`** (antrean berbasis Postgres, tanpa Redis). Butuh proses worker yang berjalan terus, jadi cocok untuk VPS atau platform container.
- Jika aplikasi di-host serverless (mis. Vercel), worker panjang tidak tersedia: gunakan penjadwal/antrean terkelola (mis. Inngest atau cron platform). Keputusan di **OD-02/OD-03**.
- Seluruh logika job ada di `src/ingest` dan dipanggil lewat antarmuka `JobRunner`, sehingga pindah antrean tidak mengubah logika.

## 5. Kualitas dan operasi

| Kebutuhan | Pilihan |
|---|---|
| Unit/integrasi | Vitest; Postgres lewat docker (Testcontainers atau compose) |
| Property-based | fast-check (alokasi, penjumlahan, pembulatan) |
| E2E | Playwright |
| Lint/format | ESLint, Prettier, commitlint |
| Log | pino (tanpa data pribadi tamu) |
| Error tracking | Sentry atau setara (opsional, setelah OD-02) |
| Kontainer | Docker multi-stage, docker-compose untuk dev |
| CI | GitHub Actions atau GitLab CI sesuai tempat repo |
| Dependensi | Lockfile wajib, `pnpm audit` di CI, pembaruan otomatis (Renovate/Dependabot) dengan jeda rilis minimal 14 hari |

## 6. Yang sengaja tidak dipakai

- Scraping atau otomasi browser terhadap OTA.
- LLM di jalur parsing produksi.
- Redis (kecuali alasan kuat muncul).
- Multi-tenant penuh dan UI admin tenant.
- Microservices: satu aplikasi Next.js + satu proses worker.

## 7. Keputusan terbuka yang memengaruhi stack

| ID | Pertanyaan | Dampak |
|---|---|---|
| OD-01 | Hosting database (Neon berbayar tanpa scale-to-zero, RDS, Supabase, Postgres sendiri) | Connection string, pooling, backup |
| OD-02 | Hosting aplikasi (VPS atau serverless) | Worker, antrean, cron |
| OD-03 | Antrean (pg-boss atau terkelola) | Bergantung OD-02 |
| OD-04 | Penyedia email masuk | Bentuk penerima email di S5-05 |
| OD-05 | Penyimpanan berkas | Implementasi `StorageProvider` produksi |

Aturan sementara: jika memakai koneksi serverless ke Postgres, gunakan connection string ber-pooling. Di proses long-running (VPS), pakai pool bawaan Prisma.
