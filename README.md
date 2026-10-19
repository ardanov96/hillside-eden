# Hillside Eden Dashboard

> Dashboard monitoring booking dan keuangan untuk satu pemilik, banyak properti di Bali (Hillside Eden & Ubud Hillside).

[![CI](https://github.com/ardanov96/hillside-eden/actions/workflows/ci.yml/badge.svg)](https://github.com/ardanov96/hillside-eden/actions/workflows/ci.yml)

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5** (strict)
- **PostgreSQL 16** + **Prisma 6**
- **Tailwind CSS 4** + shadcn/ui (segera)
- **Zod** (validasi) + **Vitest** (tes) + **Prettier** (format)

Zona waktu: **Asia/Makassar (WITA)** - Mata uang dasar: **IDR**.

## Memulai

### Prasyarat

- Node.js 22 LTS (lihat `.nvmrc`)
- pnpm 12 (`corepack enable && corepack prepare pnpm@12.4.2 --activate`)
- Docker Desktop (untuk Postgres lokal)

### Setup lokal

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm db:generate
pnpm dev
# buka http://localhost:3000
```

### Perintah standar

| Perintah               | Fungsi                           |
| ---------------------- | -------------------------------- |
| `pnpm dev`             | Jalankan Next.js (hot reload)    |
| `pnpm build`           | Build produksi                   |
| `pnpm start`           | Jalankan hasil build             |
| `pnpm lint`            | ESLint                           |
| `pnpm typecheck`       | TypeScript (`tsc --noEmit`)      |
| `pnpm test`            | Vitest (sekali jalan)            |
| `pnpm test:watch`      | Vitest (watch mode)              |
| `pnpm format`          | Prettier tulis ulang             |
| `pnpm format:check`    | Prettier cek tanpa ubah          |
| `pnpm db:generate`     | Prisma generate client           |
| `pnpm db:migrate`      | Prisma migrate dev               |
| `pnpm db:deploy`       | Prisma migrate deploy (prod)     |
| `pnpm db:studio`       | Prisma Studio                    |
| `docker compose up -d` | Nyalakan Postgres + web + worker |

## Struktur Kode

Lihat `docs/03-architecture.md`.

```
src/
  app/        # Next.js (halaman, route handler, server action)
  domain/     # Aturan bisnis & KPI (murni, tanpa I/O)
  adapters/   # Adapter OTA (airbnb, tiket, traveloka, csv-generic, manual, ical)
  ingest/     # Pipeline ingest, router adapter, dedup, antrean
  server/     # Akses data (Prisma), service, StorageProvider
  lib/        # money, dates, format id-ID, env, logger
prisma/       # schema.prisma, migrations
fixtures/     # Data uji (real/ & synthetic/)
docs/         # Dokumentasi
```

## Aturan Penting

- **Uang** selalu Decimal, dengan mata uang & kurs. Tanggal menginap bertipe `date`.
- **Koreksi** lewat entri pembalik, bukan edit/hapus. Tulis `audit_log`.
- **Estimasi** vs **aktual** harus selalu jelas (label di UI).
- Jangan scraping OTA atau automasi login extranet.
- Lihat `AGENTS.md` dan `docs/` sebelum mengubah apa pun.

## Lisensi

Proprietary - Internal BaliHoster.
