# AGENTS.md: Panduan Kerja untuk AI Agent

Proyek: **Dashboard monitoring booking dan keuangan Hillside Eden** (satu pemilik, banyak properti).
Baca dulu, berurutan: `ROADMAP.md` → `docs/README.md` → dokumen yang relevan dengan tugasmu.

## Aturan yang tidak boleh dilanggar

1. **Jangan mengarang format email/CSV OTA.** Parser hanya ditulis terhadap `fixtures/real/`. Sebelum fixture asli ada, pakai `fixtures/synthetic/` dan beri label jelas.
2. **Jangan scraping** situs OTA dan **jangan mengotomasi login extranet**. Jangan meminta kredensial OTA.
3. **Parser produksi bersifat deterministik.** LLM boleh membantu menulis atau menguji parser saat pengembangan, tetapi tidak boleh ada di jalur parsing produksi.
4. **Uang selalu `Decimal`**, bukan float. Sertakan mata uang dan kurs. Tanggal menginap bertipe `DATE`, zona waktu `Asia/Makassar`.
5. **Koreksi lewat entri pembalik**, bukan edit atau hapus pada data keuangan yang sudah terverifikasi. Tulis `audit_log`.
6. **Bedakan estimasi dan aktual** di data dan UI (komisi, kurs).
7. **Jangan mengunci keputusan terbuka** (`docs/DECISIONS.md`, bagian Open). Pakai default yang tertulis dan catat pertanyaanmu.
8. **Jangan menyentuh pilihan hosting/database** sebelum diputuskan. Kode harus agnostik hosting (Docker, konfigurasi lewat env).
9. **Jangan commit rahasia** (kredensial, URL iCal, token). Semua lewat env atau secret manager.
10. Penamaan UI wajib mengikuti `docs/07-ui-spec.md` (mis. "Pendapatan bersih (setelah komisi OTA)", "Hasil operasional").

## Perintah standar (dibuat di Sprint 0)

```
pnpm install
docker compose up -d        # postgres lokal
pnpm db:migrate             # prisma migrate dev
pnpm db:seed                # data awal + data dummy
pnpm db:seed:dummy          # (opsional) isi tabel transaksional dummy, idempoten
pnpm dev                    # web
pnpm worker                 # worker ingest/jadwal
pnpm lint && pnpm typecheck && pnpm test
pnpm test:e2e
```

## Alur kerja

- Ambil tiket dari `docs/01-development-plan.md` (ID format `S<sprint>-<nomor>`).
- **Solo developer (per Dec 2025):** tidak ada branch feature dan tidak ada PR. Kerjakan dan commit langsung ke `main`, lalu `git push origin main`. Tetap satu tiket per commit.
- Commit mengikuti Conventional Commits.
- Definition of Done (ringkas): kode + tes hijau, lint/typecheck lulus, dokumen terkait diperbarui, tidak ada TODO tanpa tiket, keputusan baru dicatat di `DECISIONS.md`.
- Jika spesifikasi ambigu: pilih default yang aman, tulis asumsi di deskripsi PR, dan tambahkan butir di `DECISIONS.md` bagian Open.
- Jangan memperluas scope. Fitur di backlog (ROADMAP bagian 11) tidak dikerjakan tanpa tiket.
