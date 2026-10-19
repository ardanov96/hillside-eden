# Indeks Dokumentasi

| Dokumen | Isi | Baca bila |
|---|---|---|
| `../ROADMAP.md` | Tujuan, fakta, keputusan, fase | Selalu, pertama |
| `01-development-plan.md` | Rencana pengembangan, sprint, tiket, risiko | Mengambil tugas |
| `02-tech-stack.md` | Pilihan teknologi, alasan, yang ditunda | Menyiapkan atau menambah dependensi |
| `03-architecture.md` | Komponen, alur data, struktur kode | Menyentuh ingest, worker, atau struktur |
| `04-data-model.md` | Entitas, constraint, draf skema Prisma | Menyentuh database |
| `05-business-rules.md` | KPI, alokasi, komisi, pengeluaran, penutupan buku | Menyentuh perhitungan |
| `06-ingestion-and-adapters.md` | Kontrak adapter, pipeline, sumber data | Menulis adapter atau importer |
| `07-ui-spec.md` | Halaman, komponen, teks UI | Menyentuh antarmuka |
| `08-quality-security-ops.md` | Tes, keamanan, privasi, operasional | Menulis tes, deploy, atau fitur sensitif |
| `DECISIONS.md` | Keputusan final dan keputusan terbuka | Sebelum mengubah apa pun yang mendasar |
| `../AGENTS.md` | Aturan kerja agent | Selalu |

Urutan baca minimal untuk tugas baru: `AGENTS.md` → `ROADMAP.md` → tiketmu di `01` → dokumen teknis yang disebut tiket.

## Glosarium

- **OTA**: online travel agent (Airbnb, Tiket.com, Traveloka, dst.).
- **Extranet**: portal pengelolaan properti di sisi OTA.
- **Listing**: halaman properti atau unit di satu OTA. **Unit**: kamar/villa fisik yang disewakan. Relasi listing-unit banyak ke banyak.
- **Estate**: seluruh properti dijual sebagai satu paket (listing gabungan beberapa unit).
- **Stay date (tanggal menginap)**: malam-malam saat tamu menginap. Dasar revenue dan okupansi.
- **Gross**: nilai booking ke tamu (sebelum komisi). **Pendapatan bersih**: gross dikurangi komisi OTA. **Hasil operasional**: pendapatan bersih + pendapatan lain − pengeluaran.
- **Channel collect**: OTA menagih tamu, menahan komisi, mentransfer sisanya. **Hotel collect**: tamu membayar di properti, komisi disetor belakangan (komisi terutang).
- **Payout**: transfer dari OTA ke client.
- **ADR / RevPAR / Okupansi**: lihat `05-business-rules.md`.
- **Fixture**: contoh data nyata (atau sintetis, diberi label) untuk tes parser.
- **Adapter**: modul yang mengubah satu jenis sumber data menjadi format booking standar.
- **WITA**: zona waktu Bali (`Asia/Makassar`, UTC+8).
