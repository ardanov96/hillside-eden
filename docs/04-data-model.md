# 04. Model Data

Status: **draf v0**. Validasi dengan `prisma validate` sebelum dipakai. Perubahan skema mengikuti pola expand/contract (lihat `08`).

## 1. Hierarki

```
organization
 └─ property (≥2)
     ├─ unit (villa/cottage/kamar)  ── inventory_config (dapat dijual atau tidak, per rentang waktu)
     └─ listing (di satu OTA) ──< listing_unit >── unit      (banyak ke banyak; estate = listing dengan banyak unit)
booking ──(listing)── booking_unit (alokasi ke unit) ── booking_event (riwayat)
payout ──< payout_booking >── booking
expense ──< expense_allocation >── property
```

## 2. Prinsip

- Uang: `Decimal(18,2)`; kurs: `Decimal(18,8)`. Simpan **mata uang asli** dan **nilai dalam mata uang dasar (IDR)** sebagai snapshot saat ingest.
- Tanggal menginap `date`; waktu kejadian `timestamptz`; zona operasional `Asia/Makassar`.
- Booking memakai kunci unik `(organization_id, channel, external_id)`.
- Data keuangan tidak dihapus: pakai status atau entri pembalik.
- Data tamu minimal (nama tampilan/inisial, negara). Tanpa kontak. Ada `retention_until`.

## 3. Enum

```
Role: OWNER | MANAGER | STAFF                    (hanya OWNER aktif)
ChannelCode: AIRBNB | TIKET_COM | TRAVELOKA | EXPEDIA | AGODA | BOOKING_COM | DIRECT | MANUAL
BookingStatus: PENDING | CONFIRMED | CANCELLED | NO_SHOW
CollectType: CHANNEL_COLLECT | HOTEL_COLLECT | UNKNOWN
CommissionBasis: ESTIMATED | ACTUAL | MANUAL
EventType: CREATED | MODIFIED | CANCELLED | NO_SHOW | PAYOUT_LINKED | MANUAL_EDIT
ImportKind: EMAIL | CSV | ICAL | MANUAL
ImportItemStatus: PARSED | DUPLICATE | FAILED | NEEDS_REVIEW
ExpenseStatus: DRAFT | VERIFIED
UnitKind: VILLA | COTTAGE | ROOM
OtherIncomeCategory: DIRECT_BOOKING | FNB | SPA | TRANSFER | OTHER
AllocationMethod: FIXED_PERCENT | ROOM_NIGHTS
RecurringFrequency: MONTHLY | ANNUAL
```

## 4. Draf skema Prisma (inti)

```prisma
model Organization {
  id           String   @id @default(cuid())
  name         String
  timezone     String   @default("Asia/Makassar")
  baseCurrency String   @default("IDR")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  users        User[]
  properties   Property[]
}

model User {
  id             String   @id @default(cuid())
  organizationId String
  email          String   @unique
  name           String
  passwordHash   String
  role           Role     @default(OWNER)
  createdAt      DateTime @default(now())
  organization   Organization @relation(fields: [organizationId], references: [id])
}

model Property {
  id             String  @id @default(cuid())
  organizationId String
  name           String
  slug           String
  address        String?
  latitude       Decimal? @db.Decimal(9, 6)
  longitude      Decimal? @db.Decimal(9, 6)
  isActive       Boolean @default(true)
  organization   Organization @relation(fields: [organizationId], references: [id])
  units          Unit[]
  listings       Listing[]
  @@unique([organizationId, slug])
}

model Unit {
  id             String   @id @default(cuid())
  organizationId String
  propertyId     String
  name           String
  kind           UnitKind
  maxGuests      Int
  bedrooms       Int?
  baseRate       Decimal? @db.Decimal(18, 2)   // bobot alokasi (opsional)
  isActive       Boolean  @default(true)
  property       Property @relation(fields: [propertyId], references: [id])
  inventory      InventoryConfig[]
  listingUnits   ListingUnit[]
  bookingUnits   BookingUnit[]
  @@index([propertyId])
}

// Kamar/unit yang dijual atau tidak pada rentang waktu tertentu (mis. hanya 2 dari 4 kamar)
model InventoryConfig {
  id         String    @id @default(cuid())
  unitId     String
  validFrom  DateTime  @db.Date
  validTo    DateTime? @db.Date
  isSellable Boolean   @default(true)
  unit       Unit      @relation(fields: [unitId], references: [id])
  @@index([unitId, validFrom])
}

model Listing {
  id             String      @id @default(cuid())
  organizationId String
  propertyId     String
  channel        ChannelCode
  externalId     String                  // ID listing di OTA
  name           String
  url            String?
  currency       String      @default("IDR")
  isActive       Boolean     @default(true)
  property       Property    @relation(fields: [propertyId], references: [id])
  listingUnits   ListingUnit[]
  bookings       Booking[]
  commissionRules CommissionRule[]
  icalFeeds      IcalFeed[]
  @@unique([organizationId, channel, externalId])
}

model ListingUnit {
  listingId        String
  unitId           String
  allocationWeight Decimal? @db.Decimal(10, 4)
  listing          Listing  @relation(fields: [listingId], references: [id])
  unit             Unit     @relation(fields: [unitId], references: [id])
  @@id([listingId, unitId])
}

model Guest {
  id             String    @id @default(cuid())
  organizationId String
  displayName    String?
  countryCode    String?
  retentionUntil DateTime?
  bookings       Booking[]
}

model Booking {
  id                  String          @id @default(cuid())
  organizationId      String
  propertyId          String
  listingId           String
  channel             ChannelCode
  externalId          String          // kode konfirmasi OTA
  status              BookingStatus
  bookedAt            DateTime?       @db.Timestamptz   // bila tidak diketahui, isi dengan waktu diterima + flag
  bookedAtIsApprox    Boolean         @default(false)
  checkIn             DateTime        @db.Date
  checkOut            DateTime        @db.Date
  nights              Int
  guestsCount         Int?
  guestId             String?
  currency            String
  grossAmount         Decimal         @db.Decimal(18, 2)   // nilai kamar/pendapatan host ke tamu, belum dipotong komisi
  taxesCollected      Decimal         @default(0) @db.Decimal(18, 2)
  cancellationFee     Decimal         @default(0) @db.Decimal(18, 2)
  commissionAmount    Decimal?        @db.Decimal(18, 2)
  commissionRate      Decimal?        @db.Decimal(6, 4)
  commissionBasis     CommissionBasis?
  collectType         CollectType     @default(UNKNOWN)
  fxRateToBase        Decimal         @default(1) @db.Decimal(18, 8)
  fxRateSource        String?
  rawPayload          Json?
  importBatchId       String?
  firstSeenAt         DateTime        @default(now())
  lastSeenAt          DateTime        @default(now())
  property            Property        @relation(fields: [propertyId], references: [id])
  listing             Listing         @relation(fields: [listingId], references: [id])
  guest               Guest?          @relation(fields: [guestId], references: [id])
  units               BookingUnit[]
  events              BookingEvent[]
  payouts             PayoutBooking[]
  @@unique([organizationId, channel, externalId])
  @@index([propertyId, checkIn, checkOut])
  @@index([listingId, checkIn])
  @@index([bookedAt])
}

// Alokasi booking ke unit; booking satu unit = satu baris 100%
model BookingUnit {
  bookingId      String
  unitId         String
  allocatedGross Decimal @db.Decimal(18, 2)
  allocationPct  Decimal @db.Decimal(7, 4)
  booking        Booking @relation(fields: [bookingId], references: [id])
  unit           Unit    @relation(fields: [unitId], references: [id])
  @@id([bookingId, unitId])
  @@index([unitId])
}

model BookingEvent {
  id          String    @id @default(cuid())
  bookingId   String
  type        EventType
  occurredAt  DateTime  @db.Timestamptz
  diff        Json?
  importItemId String?
  booking     Booking   @relation(fields: [bookingId], references: [id])
  @@index([bookingId, occurredAt])
}

// Jadwal dari iCal: hanya tanggal, TIDAK dihitung sebagai revenue
model CalendarBlock {
  id         String   @id @default(cuid())
  listingId  String
  uid        String
  startDate  DateTime @db.Date
  endDate    DateTime @db.Date
  summary    String?
  source     ImportKind @default(ICAL)
  fetchedAt  DateTime @default(now())
  @@unique([listingId, uid])
}

model IcalFeed {
  id             String   @id @default(cuid())
  listingId      String
  urlEncrypted   String             // URL iCal bersifat rahasia
  lastFetchedAt  DateTime?
  lastStatus     String?
  listing        Listing  @relation(fields: [listingId], references: [id])
}

model CommissionRule {
  id         String      @id @default(cuid())
  listingId  String?
  channel    ChannelCode
  rate       Decimal     @db.Decimal(6, 4)
  collectType CollectType @default(UNKNOWN)
  validFrom  DateTime    @db.Date
  validTo    DateTime?   @db.Date
  notes      String?
  listing    Listing?    @relation(fields: [listingId], references: [id])
  @@index([channel, validFrom])
}

model Payout {
  id          String      @id @default(cuid())
  organizationId String
  channel     ChannelCode
  payoutDate  DateTime    @db.Date
  currency    String
  amount      Decimal     @db.Decimal(18, 2)
  reference   String?
  importBatchId String?
  bookings    PayoutBooking[]
  @@index([channel, payoutDate])
}

model PayoutBooking {
  payoutId  String
  bookingId String
  amount    Decimal @db.Decimal(18, 2)
  payout    Payout  @relation(fields: [payoutId], references: [id])
  booking   Booking @relation(fields: [bookingId], references: [id])
  @@id([payoutId, bookingId])
}

model ImportBatch {
  id             String     @id @default(cuid())
  organizationId String
  kind           ImportKind
  channel        ChannelCode?
  filename       String?
  storageKey     String?
  receivedAt     DateTime   @default(now())
  stats          Json?
  items          ImportItem[]
}

model ImportItem {
  id            String           @id @default(cuid())
  batchId       String
  status        ImportItemStatus
  contentHash   String
  errorCode     String?
  errorMessage  String?
  rawRef        String?
  parsedPayload Json?
  bookingId     String?
  batch         ImportBatch      @relation(fields: [batchId], references: [id])
  @@index([status])
  @@unique([batchId, contentHash])
}

model ImportMappingProfile {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  channel        ChannelCode?
  mapping        Json              // kolom → field, format tanggal, pemisah desimal, encoding
}

model ExpenseCategory {
  id             String   @id @default(cuid())
  organizationId String
  code           String
  name           String
  parentId       String?
  sortOrder      Int      @default(0)
  isActive       Boolean  @default(true)
  @@unique([organizationId, code])
}

model Expense {
  id             String        @id @default(cuid())
  organizationId String
  propertyId     String?                      // null = biaya bersama (dialokasikan)
  categoryId     String
  amount         Decimal       @db.Decimal(18, 2)
  currency       String        @default("IDR")
  fxRateToBase   Decimal       @default(1) @db.Decimal(18, 8)
  incurredOn     DateTime      @db.Date
  paidOn         DateTime?     @db.Date
  vendor         String?
  description    String?
  paymentMethod  String?
  receiptKey     String?
  status         ExpenseStatus @default(DRAFT)
  recurringTemplateId String?
  reversalOfId   String?       @unique       // entri pembalik menunjuk entri asal
  createdById    String
  verifiedById   String?
  verifiedAt     DateTime?
  createdAt      DateTime      @default(now())
  allocations    ExpenseAllocation[]
  @@index([organizationId, incurredOn])
}

model ExpenseAllocation {
  expenseId  String
  propertyId String
  amountBase Decimal @db.Decimal(18, 2)
  expense    Expense @relation(fields: [expenseId], references: [id])
  @@id([expenseId, propertyId])
}

model RecurringExpenseTemplate {
  id          String             @id @default(cuid())
  organizationId String
  frequency   RecurringFrequency
  nextRunOn   DateTime           @db.Date
  template    Json               // nilai bawaan entri pengeluaran
  isActive    Boolean            @default(true)
}

model AllocationRule {
  id             String           @id @default(cuid())
  organizationId String
  name           String
  method         AllocationMethod
  config         Json             // mis. persentase per properti
  validFrom      DateTime         @db.Date
  validTo        DateTime?        @db.Date
}

model OtherIncome {
  id             String              @id @default(cuid())
  organizationId String
  propertyId     String?
  category       OtherIncomeCategory
  amount         Decimal             @db.Decimal(18, 2)
  currency       String              @default("IDR")
  fxRateToBase   Decimal             @default(1) @db.Decimal(18, 8)
  receivedOn     DateTime            @db.Date
  description    String?
  status         ExpenseStatus       @default(DRAFT)
  reversalOfId   String?             @unique
  createdById    String
}

model PeriodLock {
  id             String   @id @default(cuid())
  organizationId String
  period         DateTime @db.Date            // tanggal 1 bulan terkait
  lockedAt       DateTime @default(now())
  lockedById     String
  snapshot       Json                         // KPI saat penutupan
  @@unique([organizationId, period])
}

model AuditLog {
  id             String   @id @default(cuid())
  organizationId String
  actorId        String?
  action         String
  entityType     String
  entityId       String
  before         Json?
  after          Json?
  at             DateTime @default(now())
  @@index([entityType, entityId])
}
```

Catatan: relasi `Booking.importBatchId`, `Payout.importBatchId`, dan beberapa relasi pembantu belum dideklarasikan sebagai relasi Prisma di draf ini; lengkapi saat S1-01.

## 5. Constraint dan aturan integritas

- `check_out > check_in`; `nights = check_out − check_in` (hari).
- Jumlah `BookingUnit.allocatedGross` per booking **harus sama** dengan `Booking.grossAmount` (selisih pembulatan masuk ke baris terakhir). Dijaga di domain dan dites.
- Jumlah `ExpenseAllocation.amountBase` per biaya bersama **harus sama** dengan nilai biaya dalam mata uang dasar.
- Entri `Expense`/`OtherIncome` berstatus `VERIFIED` tidak boleh diubah; koreksi lewat entri baru dengan `reversalOfId`.
- Perubahan pada periode yang punya `PeriodLock` ditolak untuk entri manual. Perubahan booking yang memengaruhi periode terkunci diizinkan tetapi ditandai **penyesuaian pasca-penutupan** (lihat `05` §7).
- `ImportItem` unik per `(batchId, contentHash)`.

## 6. Indeks dan kinerja

Indeks utama sudah ada di draf. Tambahkan indeks parsial atau komposit hanya setelah S4-05 menunjukkan kebutuhan. Query laporan memakai SQL view berbasis `booking_unit` dan `expense_allocation`.

## 7. Seed awal

Kategori pengeluaran default (lihat ROADMAP Fase 1), satu organisasi, satu user owner, dua properti beserta unit dan listing contoh (data dummy berlabel).
