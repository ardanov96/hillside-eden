# Tinjauan Keamanan & Checklist Pengerasan Produksi (Security Hardening Checklist)

Dokumen ini merupakan panduan tinjauan keamanan dan checklist pengerasan pra-rilis produksi untuk **Hillside Eden & Ubud Hillside** (Sprint 8, tiket **S8-04**). Mengikuti standar arsitektur pada `docs/08-quality-security-ops.md` dan peraturan perundang-undangan (UU PDP No. 27 Tahun 2022).

---

## 1. Matriks Status Pengerasan Keamanan

| Domain | Kontrol Keamanan | Status | Keterangan Teknis |
|---|---|:---:|---|
| **Autentikasi** | Password Hashing Argon2id | **TERAPKAN** | `@node-rs/argon2` dengan profil memory & iterasi standar industri ([`src/auth.ts`](file:///c:/Dev/hillside-eden/src/auth.ts)). |
| **Sesi Cookie** | Cookie Aman (`HttpOnly`, `SameSite=Lax`) | **TERAPKAN** | Enkripsi JWT dengan durasi sesi terbatas; proteksi cookie dari pembajakan skrip. |
| **Otorisasi (proxy)** | Sesi diwajibkan untuk seluruh path non-publik | **TERAPKAN** | Proxy Next.js 16 `src/proxy.ts` + `callbacks.authorized` (`src/auth.config.ts`, ADR-029). Terverifikasi manual: tanpa sesi `/bookings` → `307 /login?callbackUrl=…`, `/api/receipts/*` & `/api/reports/export/excel` → `401`, dengan sesi → `200`. |
| **Otorisasi (tenant)** | Isolasi `organizationId` di setiap query | **PERLU DIPERBAIKI** | `CommissionRule` belum punya kolom `organizationId` dan `propertyId`/`categoryId` pada aksi pengeluaran belum divalidasi terhadap org pemanggil (tiket Sprint 12). Halaman & endpoint yang sudah memanggil `auth()` + `organizationId` aman. |
| **Webhook** | Fail-closed + anti-replay + whitelist domain | **TERAPKAN** | `src/lib/webhook-auth.ts` (ADR-030): secret wajib ada (≥ 16 karakter) → tanpa secret route membalas `503`; perbandingan secret via `timingSafeEqual`; HMAC-SHA256 wajib ber-timestamp (`timestamp + "." + body`, skew ≤ 300 detik), HMAC body-only ditolak; `/api/webhooks/*` adalah path publik di proxy tetapi route wajib menolak request tidak terautentikasi; domain email dibandingkan persis. |
| **Header HTTP** | CSP, X-Frame-Options, HSTS, Sniffing Guard | **TERAPKAN** | Dikonfigurasi di [`next.config.ts`](file:///c:/Dev/hillside-eden/next.config.ts) (`frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`). |
| **SSRF Guard** | Pencegahan SSRF pada iCal parser | **TERAPKAN** | [`fetchAndParseIcal`](file:///c:/Dev/hillside-eden/src/adapters/ical/index.ts) menolak IP privat, loopback, AWS metadata, serta memvalidasi domain publik. |
| **Privasi Tamu** | Minimisasi data & pembersihan UU PDP | **TERAPKAN** | Hanya inisial/nama dan kode negara. Modul sweeper [`guest-retention.ts`](file:///c:/Dev/hillside-eden/src/server/retention/guest-retention.ts) menganonimkan tamu kedaluwarsa. |
| **Audit Mutasi** | Jejak Audit Keuangan Permanen | **TERAPKAN** | Semua koreksi, rekonsiliasi, dan tutup buku dicatat ke tabel `AuditLog` via [`writeAudit`](file:///c:/Dev/hillside-eden/src/ingest/pipeline/audit.ts). |
| **Integritas Uang** | Tipe `Decimal(18,2)` tanpa float | **TERAPKAN** | Perhitungan keuangan murni menggunakan Prisma/Decimal tanpa rounding error IEEE 754. |
| **Rahasia & Kunci** | Enkripsi Secret via Environment | **TERAPKAN** | Menggunakan `.env` aman; kredensial rahasia (iCal, DB URL) tidak pernah di-commit ke Git repo. |

---

## 2. Checklist Verifikasi Operasional Pra-Rilis

- [x] **Tidak ada kredensial OTA extranet yang diminta/disimpan:** Akses murni melalui email, ekspor CSV, atau webhook resmi.
- [x] **Database connection pooling terkonfigurasi:** Neon pooled URL (`-pooler`) untuk runtime serverless dan direct URL untuk Prisma migrate ([ADR-014](file:///c:/Dev/hillside-eden/docs/DECISIONS.md#L22)).
- [x] **Tutup buku terkunci aman:** Periode yang telah ditutup membekukan snapshot finansial dan memunculkan notifikasi variansi bila ada perubahan historis.
- [x] **Pemeriksaan dependensi:** Dependensi lockfile pnpm terpin dan tervalidasi melalui `pnpm audit` dan policy supply-chain.
- [x] **Sanitasi loging pino/console:** Tidak ada nama lengkap tamu, email kontak pribadi, atau connection string password yang dicetak ke file log produksi.
