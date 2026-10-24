# Prosedur Backup & Pemulihan Bencana (Disaster Recovery Runbook)

Dokumen ini merupakan panduan operasional resmi untuk **Hillside Eden & Ubud Hillside** (Sprint 8, tiket **S8-02**).

## 1. Sasaran Pemulihan (RPO & RTO - OD-14)

| Parameter | Sasaran yang Disepakati | Mekanisme |
|---|---|---|
| **RPO (Recovery Point Objective)** | **≤ 24 Jam** (Data logis) / **≤ 6 Jam** (PITR Neon) | Backup logis harian otomatis + snapshot point-in-time database host |
| **RTO (Recovery Time Objective)** | **< 1 Jam** | Restore branch Neon instan atau import berkas snapshot tervalidasi |

## 2. Strategi Backup

1. **Backup Logis Terjadwal (`scripts/backup-db.ts`):**
   - Menghasilkan berkas arsip JSON berisi seluruh tabel master dan transaksional: `Organization`, `Property`, `Unit`, `Listing`, `Booking`, `BookingEvent`, `Payout`, `Expense`, `PeriodLock`, `AuditLog`.
   - Menghasilkan checksum SHA-256 untuk memverifikasi bahwa berkas tidak rusak atau diubah (anti-tamper).
   - Eksekusi harian via cron/CI ke penyimpanan terpisah (S3-compatible bucket / object storage).

2. **PITR (Point-in-Time Restore) Neon:**
   - Host database Neon mendukung restore instan ke titik waktu mana pun dalam jendela retensi (6 jam pada Free plan, 7 hari pada Launch plan - OD-24).

## 3. Perintah Standar Operasional

### Menjalankan Backup
```bash
# Menjalankan backup logis ke folder default backups/
pnpm db:backup

# Menjalankan backup ke direktori tujuan tertentu
pnpm tsx scripts/backup-db.ts /path/ke/penyimpanan
```

### Memverifikasi Integritas File Backup (Uji Restore)
```bash
# Menjalankan verifikasi checksum SHA-256 dan konsistensi matematis keuangan
pnpm tsx scripts/restore-and-verify.ts backups/backup-hillside-eden-[timestamp].json
```

Output verifikasi mencakup:
* Keutuhan relasi foreign-key (Property, Unit, Listing).
* Validasi matematis: `Gross = Net + Komisi OTA`.
* Validasi kelengkapan audit log dan snapshot `PeriodLock`.

## 4. Prosedur Tanggap Darurat Bencana (Disaster Recovery)

Jika terjadi insiden data terkorupsi, salah input massal, atau kegagalan host:

1. **Langkah 1: Identifikasi Titik Aman Terakhir (Point of Integrity)**
   - Cek daftar file backup terakhir di penyimpanan aman.
   - Jalankan `pnpm tsx scripts/restore-and-verify.ts <backup_file>` untuk memastikan data bersih dan seimbang.

2. **Langkah 2: Pemulihan di Neon (Opsi Utama - RTO < 10 Menit)**
   - Buka console Neon (`console.neon.tech`).
   - Buat branch baru dari branch `main` pada timestamp sebelum insiden terjadi.
   - Arahkan `DATABASE_URL` dan `DIRECT_DATABASE_URL` pada platform hosting (Vercel/VPS) ke connection string branch yang baru.
   - Uji endpoint `/api/health` untuk memverifikasi koneksi.

3. **Langkah 3: Pemulihan Offline / Database Baru (Opsi Sekunder)**
   - Nyalakan database Postgres baru (misal via `docker compose up -d`).
   - Jalankan `pnpm db:deploy` untuk membuat skema tabel yang bersih.
   - Muat ulang data tervalidasi menggunakan berkas backup terakhir.

4. **Langkah 4: Verifikasi Pasca-Pemulihan**
   - Login ke dashboard `/` dan `/reports`.
   - Cocokkan metrik Gross, Komisi, Net, dan Hasil Operasional dengan lembar laporan tercetak/arsip terakhir.
   - Catat kejadian dan langkah pemulihan ke `AuditLog`.
