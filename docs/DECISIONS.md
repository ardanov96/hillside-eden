# DECISIONS: Log Keputusan

Format: **ID Â· Status Â· Keputusan Â· Alasan**. Keputusan final hanya diubah lewat entri baru yang menggantikan (jangan menghapus riwayat). Pertanyaan baru dari agent ditambahkan di bagian Open dengan default yang dipakai sementara.

## A. Keputusan final

| ID | Keputusan | Alasan |
|---|---|---|
| ADR-001 | Dashboard monitoring booking dan keuangan adalah proyek utama. Website direct booking dan channel manager ditunda | Kebutuhan mendesak client adalah memantau kinerja OTA yang sudah live |
| ADR-002 | Satu organisasi, banyak properti; satu admin (pemilik). `organization_id` ada di tabel inti; tanpa UI multi-tenant | Semua properti satu pemilik; ongkos retrofit rendah |
| ADR-003 | Revenue dan okupansi berdasarkan **tanggal menginap**; pace dan lead time berdasarkan tanggal booking; kas berdasarkan tanggal payout | Tanggal booking bukan kapan pendapatan terjadi atau uang masuk |
| ADR-004 | **Gross dan net berdampingan**; komisi dibedakan estimasi vs aktual; model bayar channel/hotel collect dicatat | Pemilik perlu tahu nilai yang disetor ke OTA dan yang tersisa |
| ADR-005 | Dilarang scraping OTA dan otomasi login extranet | Melanggar ketentuan platform, rapuh, berisiko akun diblokir |
| ADR-006 | Stack: Next.js (App Router) + TypeScript + PostgreSQL + Prisma, SQL/view untuk laporan, Docker, agnostik hosting | Dikuasai pengembang, komponen minimal |
| ADR-007 | Parser produksi deterministik; LLM hanya membantu saat pengembangan | Akurasi dan ketertelusuran data keuangan |
| ADR-008 | Koreksi keuangan lewat entri pembalik; penutupan periode dengan snapshot | Menjaga laporan lama stabil dan dapat diaudit |
| ADR-009 | Penamaan UI: "Pendapatan bersih (setelah komisi OTA)" dan "Hasil operasional"; tidak memakai "net income"/"laba" | Menghindari salah tafsir sebagai laba |
| ADR-010 | Potongan tambahan selain komisi OTA ditunda sampai diminta client | Fokus pada ringkasan pemasukan dikurangi pengeluaran standar |
| ADR-011 | Modul pengeluaran: input manual, kategori standar operasional, alokasi biaya bersama, status draf/terverifikasi | Tidak ada sumber data otomatis untuk pengeluaran |
| ADR-012 | iCal hanya menghasilkan `CalendarBlock`, tidak pernah booking atau revenue | iCal hanya memuat tanggal |
| ADR-013 | Prioritas sumber awal: Tiket.com, Traveloka, Airbnb. Expedia Group dan Agoda masuk backlog | Listing yang dipastikan live oleh client |

## B. Open (jangan dikunci tanpa konfirmasi)

| ID | Pertanyaan | Default sementara | Memengaruhi |
|---|---|---|---|
| OD-01 | Hosting database (Neon berbayar tanpa scale-to-zero / RDS / Supabase / Postgres sendiri) | Postgres lokal via docker; kode agnostik | Deploy, pooling, backup |
| OD-16 | Port Postgres dev lokal di Windows: 5432 bentrok dengan `postgresql-x64-17` (layanan Windows yang tidak bisa dihentikan tanpa admin). Pakai **5433** di host, kontainer tetap 5432 | Pengembangan lokal di Windows tanpa konflik port; .env.example & docker-compose.yml sudah disesuaikan | Lokal dev |
| OD-02 | Hosting aplikasi (VPS atau serverless) | Kontainer agnostik | Worker, antrean |
| OD-03 | Antrean: pg-boss atau layanan terkelola | pg-boss di balik `JobRunner` | S2, S5 |
| OD-17 | Import Decimal: `@prisma/client` tidak mengekspor `Decimal` sebagai top-level (cuma `Prisma.Decimal`). Pakai wrapper `src/lib/decimal.ts` yang re-export `Prisma.Decimal` sebagai `Decimal` (konsisten, satu titik import) | Tipe Decimal selalu identik dengan generator Prisma; modul money/dates tidak perlu tahu path runtime Prisma | Modul `src/lib/*` |
| OD-18 | Presisi pembulatan `nightlyAllocation` per mata uang (IDR=0 dp, USD=2 dp) | Konsisten dengan IDR tanpa sub-unit; contoh docs/05 s9.1 (3.000.001/3 -> [1M, 1M, 1.001M]) pakai IDR 0 dp. ADR/RevPAR tetap raw Decimal; pembulatan tampilan terpisah. | `src/domain/kpi.ts` `currencyPlaces` & `nightlyAllocation` |
| OD-04 | Penyedia email masuk (webhook vs IMAP) | Antarmuka `InboundEmailSource`, implementasi menyusul | S5-05 |
| OD-05 | Penyimpanan berkas produksi | `StorageProvider` lokal untuk dev | S3-02, S5 |
| OD-06 | Kebijakan data tamu dan masa retensi | Minimal: nama tampilan/inisial + negara, tanpa kontak | Skema `guest`, retensi |
| OD-07 | Alokasi booking estate ke unit | Bobot: `allocationWeight` → `baseRate` → `maxGuests` → sama rata. Diimplementasikan di `src/domain/allocation.ts` (`allocateBookingToUnits`); presisi minor unit per OD-18; unit terakhir menyerap sisa gross dan sisa pct (sum=1.0000). | KPI per unit, ingest booking_unit |
| OD-08 | Kebijakan kurs (sumber dan frekuensi) | Input manual per bulan, dilabeli; kurs aktual payout bila ada | Revenue non-IDR |
| OD-09 | Perlakuan pembatalan berbiaya dan no-show | Lihat `05` Â§4 | KPI, revenue |
| OD-10 | Identitas listing Traveloka ("Hillside Eden Jungle Estate" vs "Hillside Eden Bali, Gianyar") | Dianggap belum jelas; adapter tidak ditulis | S6-03 |
| OD-11 | Sumber listing Tiket.com (distribusi Expedia atau extranet sendiri) | Dianggap belum terverifikasi | S6-02 |
| OD-12 | Daftar kategori pengeluaran final (selaras akuntan client). Default seed S1-02: `SALARY` (Gaji & tunjangan), `UTILITIES` (Utilitas - listrik, air, gas), `INTERNET` (Internet & komunikasi), `HOUSEKEEPING` (Housekeeping, laundry, amenities), `MAINTENANCE` (Perawatan & perbaikan), `MARKETING` (Pemasaran & software/platform), `TAX_LICENSE_INSURANCE` (Pajak, perizinan, asuransi), `TRANSPORT` (Transportasi & operasional lain), `RENT_LEASE` (Sewa / lease), `MISC` (Lain-lain). Akan divalidasi ulang saat S3-01 dengan konfirmasi akuntan client. Default `AllocationRule` shared (`method=ROOM_NIGHTS`, name `Biaya bersama - room nights terjual`) dibuat oleh S1-02. | S1-02, S3-01 |
| OD-19 | Nilai-nilai pada data dummy (S1-06): rate komisi OTA dan kurs USD→IDR belum diketahui karena kontrak OTA belum diverifikasi (OD-10, OD-11) dan kebijakan kurs masih terbuka (OD-08) | Digunakan **asumsi dummy berlabel**: komisi Airbnb 14%, Tiket.com 15%, Traveloka 13% (`commissionBasis=ESTIMATED` sampai ada payout nyata, lalu `ACTUAL`); kurs USD→IDR bergeser 15.900–16.400 per bulan dengan `fxRateSource="DUMMY:usd-idr-monthly-drift"`. Angka ini HANYA untuk mengisi dashboard saat pengembangan dan tidak boleh dipakai sebagai referensi kontrak. `taxesCollected` selalu 0 karena kebijakan pajak belum ditetapkan. `OtherIncome` sengaja dikosongkan karena keputusan pemasukan non-OTA masih terbuka (OD-13). Generator `src/dev/dummy-data.ts` deterministik (PRNG ber-seed tetap) supaya data dapat direproduksi; seluruh stok dummy memakai label `DUMMY-` pada `externalId`, `[DUMMY]` pada vendor/deskripsi, dan `dummy/` pada filename impor. | Dashboard dev, S1-06 |
| OD-13 | Ada tidaknya pemasukan non-OTA dan jenisnya | Disediakan `OtherIncome` manual | S3-06 |
| OD-14 | RPO/RTO yang disepakati | Backup harian + uji restore bulanan | S8-02 |
| OD-15 | Panjang sprint | 1 minggu (asumsi) | Jadwal |

## C. Template entri baru

```
### ADR-0xx / OD-xx: judul
- Konteks:
- Pilihan:
- Keputusan / default sementara:
- Konsekuensi:
- Ditetapkan oleh / tanggal:
```