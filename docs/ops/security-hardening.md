# Tinjauan Keamanan & Checklist Pengerasan Produksi (Security Hardening Checklist)

Dokumen ini merupakan panduan tinjauan keamanan dan checklist pengerasan pra-rilis produksi untuk **Hillside Eden & Ubud Hillside** (Sprint 8, tiket **S8-04**). Mengikuti standar arsitektur pada `docs/08-quality-security-ops.md` dan peraturan perundang-undangan (UU PDP No. 27 Tahun 2022).

---

## 1. Matriks Status Pengerasan Keamanan

| Domain | Kontrol Keamanan | Status | Keterangan Teknis |
|---|---|:---:|---|
| **Autentikasi** | Password Hashing Argon2id | **TERAPKAN** | `@node-rs/argon2` dengan profil memory & iterasi standar industri ([`src/auth.ts`](file:///c:/Dev/hillside-eden/src/auth.ts)). Tes: `tests/auth.test.ts`. |
| **Sesi Cookie** | Cookie Aman (`HttpOnly`, `SameSite=Lax`) | **TERAPKAN** | Enkripsi JWT dengan durasi sesi terbatas; proteksi cookie dari pembajakan skrip. Tes: `tests/auth.test.ts`. |
| **Otorisasi (proxy)** | Sesi diwajibkan untuk seluruh path non-publik | **TERAPKAN** | Proxy Next.js 16 `src/proxy.ts` + `callbacks.authorized` (`src/auth.config.ts`, ADR-029). Terverifikasi manual: tanpa sesi `/bookings` → `307 /login?callbackUrl=…`, `/api/receipts/*` & `/api/reports/export/excel` → `401`, dengan sesi → `200`. Tes: `tests/auth.test.ts` (`isPublicPath`). |
| **Host Tepercaya (Auth.js)** | `trustHost` dikonfigurasi eksplisit | **TERAPKAN** | `src/lib/auth-trust-host.ts` (ADR-032): `AUTH_URL` (URL kanonis, pilihan utama) atau `AUTH_TRUST_HOST=true` (hanya bila reverse proxy/platform dijamin men-set `Host`). Tanpa keduanya di produksi → validasi env saat boot menghentikan proses (`exit 1`), bukan error `UntrustedHost` saat login. Tes: `tests/lib/auth-trust-host.test.ts`, `tests/lib/env.test.ts`. |
| **Otorisasi (tenant)** | Isolasi `organizationId` di setiap query | **TERAPKAN** | `CommissionRule` punya kolom `organizationId` + migrasi Prisma (`20261116020945_add_organizationid_to_commission_rule`). `create/update/deleteCommissionRule`, `listCommissionRules`, `getCommissionRuleById`, `estimateCommissionForBooking`, `getCommissionReconciliation` difilter tenant. `propertyId`/`categoryId` divalidasi milik organisasi (P1-5, ADR-036). Tes: `tests/server/actions/expenses.test.ts`, `tests/server/queries/commissions.test.ts`. |
| **Webhook** | Fail-closed + anti-replay + whitelist domain | **TERAPKAN** | `src/lib/webhook-auth.ts` (ADR-030): secret wajib ada (≥ 16 karakter) → tanpa secret route membalas `503`; perbandingan secret via `timingSafeEqual`; HMAC-SHA256 wajib ber-timestamp (`timestamp + "." + body`, skew ≤ 300 detik), HMAC body-only ditolak; `/api/webhooks/*` adalah path publik di proxy tetapi route wajib menolak request tidak terautentikasi; domain email dibandingkan persis. Tes: `tests/lib/webhook-auth.test.ts` (28), `tests/server/webhooks/` (5). |
| **Header HTTP** | CSP non-based (nonce), HSTS, rate limit login | **TERAPKAN** | `next.config.ts` (`frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, HSTS). `src/proxy.ts` generate CSP nonce per-request (P2-9). `src/lib/rate-limit.ts` rate limit login (5 percobaan/15 menit). `/api/health?deep=1` butuh autentikasi. Tes: `tests/server/monitoring.test.ts`. |
| **SSRF Guard** | Pencegahan SSRF pada iCal parser & redirect | **TERAPKAN** | [`fetchAndParseIcal`](file:///c:/Dev/hillside-eden/src/adapters/ical/fetcher.ts) menolak IP privat, loopback, AWS metadata, memvalidasi domain publik, dan mengikuti redirect secara manual dengan validasi tiap hop (P2-6). Tes: `tests/adapters/ical.test.ts`. |
| **Privasi Tamu** | Minimisasi data & pembersihan UU PDP | **TERAPKAN** | Hanya inisial/nama dan kode negara. Modul sweeper [`guest-retention.ts`](file:///c:/Dev/hillside-eden/src/server/retention/guest-retention.ts) menganonimkan tamu kedaluwarsa, buang `rawPayload` booking + `parsedPayload` item impor, hapus blob impor (P2-8). Tes: `tests/server/retention/guest-retention.test.ts`. |
| **Audit Mutasi** | Jejak Audit Keuangan Permanen | **TERAPKAN** | Semua koreksi, rekonsiliasi, dan tutup buku dicatat ke tabel `AuditLog` via [`writeAudit`](file:///c:/Dev/hillside-eden/src/ingest/pipeline/audit.ts). |
| **Integritas Uang** | Tipe `Decimal(18,2)` tanpa float | **TERAPKAN** | Perhitungan keuangan murni menggunakan Prisma/Decimal tanpa rounding error IEEE 754. |
| **Rahasia & Kunci** | Enkripsi Secret via Environment | **TERAPKAN** | `.env` aman; kredensial rahasia (iCal, DB URL) tidak pernah di-commit. `ENCRYPTION_KEY` wajib di produksi (≥ 32 karakter), fallback literal dihapus dari `src/lib/crypto.ts`, validasi env saat boot (`src/instrumentation.ts` → `src/instrumentation.node.ts` → `validateEnv()`, kegagalan → process exit 1; diverifikasi: `next start` tanpa `ENCRYPTION_KEY` → exit 1, tanpa listener). Rotasi kunci: `pnpm encrypt:rotate --apply` (ADR-031). Pengisian secret: `pnpm secrets:generate` — nilai acak kuat, tidak dicetak, secret lama tidak ditimpa (ADR-033). |
| **Rahasia OTA** | Vault kredensial terenkripsi | **TERAPKAN** | `secrets/ota-credentials.enc.json` (AES-256-GCM, kunci `OTA_VAULT_KEY`; skrip `scripts/ota-vault.ts`); plaintext `akses_OTA.txt` dihapus setelah verifikasi dekripsi identik; tidak di-commit (`/secrets/` di-gitignore). Digunakan manual oleh pemilik (ADR-034). Tes: `tests/scripts/ota-vault.test.ts`. |
| **Unggahan Berkas** | Allowlist MIME + magic bytes + nama file | **TERAPKAN** | `src/lib/upload-validation.ts` (P2-7): allowlist MIME (image/jpeg, image/png, image/webp, application/pdf), verifikasi magic bytes (isi berkas, bukan header klien), sanitasi nama berkas, maks 10 MB. Endpoint unduhan struk pakai `Content-Disposition: attachment`. Tes: `tests/lib/upload-validation.test.ts`, `tests/server/actions/expenses.test.ts`. |

---

## 2. Checklist Verifikasi Operasional Pra-Rilis

- [x] **Tidak ada kredensial OTA extranet yang diminta/disimpan:** Akses murni melalui email, ekspor CSV, atau webhook resmi.
- [x] **Database connection pooling terkonfigurasi:** Neon pooled URL (`-pooler`) untuk runtime serverless dan direct URL untuk Prisma migrate ([ADR-014](file:///c:/Dev/hillside-eden/docs/DECISIONS.md#L22)).
- [x] **Tutup buku terkunci aman:** Periode yang telah ditutup membekukan snapshot finansial dan memunculkan notifikasi variansi bila ada perubahan historis.
- [x] **Pemeriksaan dependensi:** Dependensi lockfile pnpm terpin dan tervalidasi melalui `pnpm audit` dan policy supply-chain.
- [x] **Sanitasi loging pino/console:** Tidak ada nama lengkap tamu, email kontak pribadi, atau connection string password yang dicetak ke file log produksi.
