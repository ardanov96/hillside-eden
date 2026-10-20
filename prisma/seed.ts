/**
 * Seed Hillside Eden - S1-02.
 *
 * Cakupan:
 * - 1 Organization (Hillside Eden, IDR base, Asia/Makassar)
 * - 2 Property:
 *     Hillside Eden (Payangan) - estate 4 unit (1 VILLA + 3 COTTAGE)
 *     Ubud Hillside (Bentuyung, Ubud) - 4 ROOM, 2 sellable
 * - Listing per OTA (Airbnb, Tiket.com, Traveloka) + tautan ListingUnit
 * - InventoryConfig untuk jendela 1 tahun (default mulai hari ini, WITA)
 * - ExpenseCategory default sesuai docs/05-business-rules.md sec.6
 * - 1 AllocationRule shared default (ROOM_NIGHTS)
 *
 * Idempoten: semua entitas yang punya kunci unik dipakai upsert;
 * untuk entitas tanpa kunci alami (InventoryConfig, AllocationRule)
 * kita cek dulu via Prisma dan skip bila sudah ada.
 *
 * CATATAN:
 * - User owner sengaja TIDAK dibuat di sini (lihat S1-03 Auth.js).
 * - Listing Tiket.com / Traveloka dibuat dengan externalId placeholder
 *   dan isActive=false menunggu verifikasi akses extranet (OD-10, OD-11).
 * - Daftar ExpenseCategory adalah default; akan divalidasi ulang dengan
 *   akuntan client di S3-01 (lihat DECISIONS.md OD-12).
 */
import { PrismaClient, ChannelCode, UnitKind, AllocationMethod } from "@prisma/client";
import { addDays, todayInWITA } from "../src/lib/dates";
import { hashPassword } from "../src/lib/argon2";

const prisma = new PrismaClient();

const ORG_NAME = "Hillside Eden";

const PROPERTY_HILLSIDE_EDEN = {
  name: "Hillside Eden",
  slug: "hillside-eden",
  address: "Desa Puhu/Penginyahan, Payangan, Gianyar, Bali",
};

const PROPERTY_UBUD_HILLSIDE = {
  name: "Ubud Hillside",
  slug: "ubud-hillside",
  address: "Bentuyung, Kecamatan Ubud, Bali",
};

// Default kategori pengeluaran (lihat docs/05-business-rules.md sec.6).
const DEFAULT_EXPENSE_CATEGORIES: ReadonlyArray<{
  code: string;
  name: string;
  sortOrder: number;
}> = [
  { code: "SALARY", name: "Gaji & tunjangan", sortOrder: 10 },
  { code: "UTILITIES", name: "Utilitas (listrik, air, gas)", sortOrder: 20 },
  { code: "INTERNET", name: "Internet & komunikasi", sortOrder: 30 },
  { code: "HOUSEKEEPING", name: "Housekeeping, laundry, amenities", sortOrder: 40 },
  { code: "MAINTENANCE", name: "Perawatan & perbaikan", sortOrder: 50 },
  { code: "MARKETING", name: "Pemasaran & software/platform", sortOrder: 60 },
  { code: "TAX_LICENSE_INSURANCE", name: "Pajak, perizinan, asuransi", sortOrder: 70 },
  { code: "TRANSPORT", name: "Transportasi & operasional lain", sortOrder: 80 },
  { code: "RENT_LEASE", name: "Sewa / lease", sortOrder: 90 },
  { code: "MISC", name: "Lain-lain", sortOrder: 100 },
];

// Helper: konversi 'YYYY-MM-DD' (StayDate) ke Date UTC midnight (tipe @db.Date Prisma).
function fromStayDateLocal(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

async function seedOrganization() {
  return prisma.organization.upsert({
    where: { id: "seed-organization" },
    update: { name: ORG_NAME },
    create: {
      id: "seed-organization",
      name: ORG_NAME,
      timezone: "Asia/Makassar",
      baseCurrency: "IDR",
    },
  });
}

async function seedProperty(orgId: string, slug: string, name: string, address: string) {
  return prisma.property.upsert({
    where: { organizationId_slug: { organizationId: orgId, slug } },
    update: { name, address, isActive: true },
    create: {
      organizationId: orgId,
      name,
      slug,
      address,
      isActive: true,
    },
  });
}

async function seedUnit(
  orgId: string,
  propertyId: string,
  name: string,
  kind: UnitKind,
  maxGuests: number,
  opts: { bedrooms?: number; baseRate?: string } = {},
) {
  // Tidak ada kunci unik selain id. Pakai nama + propertyId sebagai pencocokan.
  const existing = await prisma.unit.findFirst({ where: { propertyId, name } });
  if (existing) {
    return prisma.unit.update({
      where: { id: existing.id },
      data: {
        kind,
        maxGuests,
        bedrooms: opts.bedrooms ?? null,
        baseRate: opts.baseRate ?? null,
        isActive: true,
      },
    });
  }
  return prisma.unit.create({
    data: {
      organizationId: orgId,
      propertyId,
      name,
      kind,
      maxGuests,
      bedrooms: opts.bedrooms ?? null,
      baseRate: opts.baseRate ?? null,
    },
  });
}

async function seedInventoryConfig(unitId: string, validFrom: Date, isSellable: boolean) {
  const existing = await prisma.inventoryConfig.findFirst({ where: { unitId, validFrom } });
  if (existing) return existing;
  return prisma.inventoryConfig.create({ data: { unitId, validFrom, isSellable } });
}

async function seedInventoryWindow(unitId: string, validFrom: Date, validTo: Date) {
  const cfg = await prisma.inventoryConfig.findFirst({ where: { unitId, validFrom } });
  if (cfg && cfg.validTo === null) {
    await prisma.inventoryConfig.update({ where: { id: cfg.id }, data: { validTo } });
  }
}

async function seedListing(
  orgId: string,
  propertyId: string,
  channel: ChannelCode,
  externalId: string,
  name: string,
  url: string | null,
  opts: { isActive?: boolean; currency?: string } = {},
) {
  return prisma.listing.upsert({
    where: {
      organizationId_channel_externalId: {
        organizationId: orgId,
        channel,
        externalId,
      },
    },
    update: { name, url, isActive: opts.isActive ?? true },
    create: {
      organizationId: orgId,
      propertyId,
      channel,
      externalId,
      name,
      url,
      currency: opts.currency ?? "IDR",
      isActive: opts.isActive ?? true,
    },
  });
}

async function seedListingUnit(listingId: string, unitId: string, allocationWeight?: string) {
  return prisma.listingUnit.upsert({
    where: { listingId_unitId: { listingId, unitId } },
    update: { allocationWeight: allocationWeight ?? null },
    create: {
      listingId,
      unitId,
      allocationWeight: allocationWeight ?? null,
    },
  });
}

async function seedExpenseCategory(orgId: string, code: string, name: string, sortOrder: number) {
  return prisma.expenseCategory.upsert({
    where: { organizationId_code: { organizationId: orgId, code } },
    update: { name, sortOrder, isActive: true },
    create: { organizationId: orgId, code, name, sortOrder, isActive: true },
  });
}

async function seedAllocationRuleShared(orgId: string) {
  const existing = await prisma.allocationRule.findFirst({
    where: { organizationId: orgId, name: "Biaya bersama - room nights terjual" },
  });
  if (existing) return existing;
  return prisma.allocationRule.create({
    data: {
      organizationId: orgId,
      name: "Biaya bersama - room nights terjual",
      method: AllocationMethod.ROOM_NIGHTS,
      config: {
        note: "Default. Dialokasikan proporsional room-nights terjual per periode.",
      },
      validFrom: new Date(`${todayInWITA().slice(0, 4)}-01-01`),
    },
  });
}

async function main() {
  console.log("[seed] mulai");

  // 1. Organization
  const org = await seedOrganization();
  console.log(`[seed] organization: ${org.name} (${org.id})`);

  const today = todayInWITA();
  const inventoryValidFrom = fromStayDateLocal(today);
  const inventoryValidTo = fromStayDateLocal(addDays(today, 365));

  // 2. Property Hillside Eden + unit estate (1 VILLA + 3 COTTAGE)
  const propHE = await seedProperty(
    org.id,
    PROPERTY_HILLSIDE_EDEN.slug,
    PROPERTY_HILLSIDE_EDEN.name,
    PROPERTY_HILLSIDE_EDEN.address,
  );
  console.log(`[seed] property: ${propHE.name}`);

  const villa = await seedUnit(org.id, propHE.id, "Villa Utama", UnitKind.VILLA, 8, {
    bedrooms: 4,
    baseRate: "4000000",
  });
  const cottage1 = await seedUnit(org.id, propHE.id, "Cottage 1", UnitKind.COTTAGE, 2, {
    bedrooms: 1,
    baseRate: "1500000",
  });
  const cottage2 = await seedUnit(org.id, propHE.id, "Cottage 2", UnitKind.COTTAGE, 2, {
    bedrooms: 1,
    baseRate: "1500000",
  });
  const cottage3 = await seedUnit(org.id, propHE.id, "Cottage 3", UnitKind.COTTAGE, 2, {
    bedrooms: 1,
    baseRate: "1500000",
  });

  for (const u of [villa, cottage1, cottage2, cottage3]) {
    await seedInventoryConfig(u.id, inventoryValidFrom, true);
    await seedInventoryWindow(u.id, inventoryValidFrom, inventoryValidTo);
  }

  // 3. Property Ubud Hillside + 4 ROOM (2 sellable, 2 non-sellable)
  const propUH = await seedProperty(
    org.id,
    PROPERTY_UBUD_HILLSIDE.slug,
    PROPERTY_UBUD_HILLSIDE.name,
    PROPERTY_UBUD_HILLSIDE.address,
  );
  console.log(`[seed] property: ${propUH.name}`);

  const uhRoom1 = await seedUnit(org.id, propUH.id, "Kamar 1", UnitKind.ROOM, 2, {
    bedrooms: 1,
    baseRate: "800000",
  });
  const uhRoom2 = await seedUnit(org.id, propUH.id, "Kamar 2", UnitKind.ROOM, 2, {
    bedrooms: 1,
    baseRate: "800000",
  });
  const uhRoom3 = await seedUnit(org.id, propUH.id, "Kamar 3", UnitKind.ROOM, 2, {
    bedrooms: 1,
    baseRate: "800000",
  });
  const uhRoom4 = await seedUnit(org.id, propUH.id, "Kamar 4", UnitKind.ROOM, 2, {
    bedrooms: 1,
    baseRate: "800000",
  });

  // Ubud Hillside: hanya kamar 1 & 2 sellable (sesuai ROADMAP sec.2 listing Airbnb).
  const sellableMap: ReadonlyArray<readonly [typeof uhRoom1, boolean]> = [
    [uhRoom1, true],
    [uhRoom2, true],
    [uhRoom3, false],
    [uhRoom4, false],
  ];
  for (const [u, sellable] of sellableMap) {
    await seedInventoryConfig(u.id, inventoryValidFrom, sellable);
    await seedInventoryWindow(u.id, inventoryValidFrom, inventoryValidTo);
  }

  // 4. Listing per OTA + tautan ListingUnit
  //    Hillside Eden: estate listing per OTA (link semua 4 unit)
  //    Ubud Hillside: 1 listing Airbnb (link 2 kamar sellable)

  const heEstateAirbnb = await seedListing(
    org.id,
    propHE.id,
    ChannelCode.AIRBNB,
    "he-airbnb-estate",
    "Hillside Eden Bali - Estate (Airbnb)",
    "https://www.airbnb.co.id/rooms/he-estate",
  );
  await seedListingUnit(heEstateAirbnb.id, villa.id);
  await seedListingUnit(heEstateAirbnb.id, cottage1.id);
  await seedListingUnit(heEstateAirbnb.id, cottage2.id);
  await seedListingUnit(heEstateAirbnb.id, cottage3.id);

  // Tiket.com & Traveloka: externalId placeholder, isActive=false
  // (menunggu verifikasi akses extranet, lihat DECISIONS OD-10/OD-11).
  const heEstateTiket = await seedListing(
    org.id,
    propHE.id,
    ChannelCode.TIKET_COM,
    "pending-verify-he-tiket",
    "Hillside Eden Bali - Estate (Tiket.com)",
    "https://www.tiket.com/id-id/homes/indonesia/hillside-eden-bali-108001534518821159",
    { isActive: false },
  );
  await seedListingUnit(heEstateTiket.id, villa.id);
  await seedListingUnit(heEstateTiket.id, cottage1.id);
  await seedListingUnit(heEstateTiket.id, cottage2.id);
  await seedListingUnit(heEstateTiket.id, cottage3.id);

  const heEstateTraveloka = await seedListing(
    org.id,
    propHE.id,
    ChannelCode.TRAVELOKA,
    "pending-verify-he-traveloka",
    "Hillside Eden Bali - Estate (Traveloka)",
    "https://www.traveloka.com/id-id/hotel/indonesia/hillside-eden-jungle-estate-9000005507737",
    { isActive: false },
  );
  await seedListingUnit(heEstateTraveloka.id, villa.id);
  await seedListingUnit(heEstateTraveloka.id, cottage1.id);
  await seedListingUnit(heEstateTraveloka.id, cottage2.id);
  await seedListingUnit(heEstateTraveloka.id, cottage3.id);

  // Ubud Hillside: 1 listing Airbnb (4 kamar tapi hanya 2 yang dijual).
  const uhAirbnb = await seedListing(
    org.id,
    propUH.id,
    ChannelCode.AIRBNB,
    "uh-airbnb-rooms",
    "Ubud Hillside - 2 kamar pribadi (Airbnb)",
    "https://www.airbnb.co.id/rooms/1009025545235278907",
  );
  await seedListingUnit(uhAirbnb.id, uhRoom1.id);
  await seedListingUnit(uhAirbnb.id, uhRoom2.id);

  console.log(
    "[seed] listings: 4 (1 aktif Airbnb Hillside Eden, 2 placeholder nonaktif, 1 Airbnb Ubud Hillside)",
  );

  // 5. Default ExpenseCategory
  for (const c of DEFAULT_EXPENSE_CATEGORIES) {
    await seedExpenseCategory(org.id, c.code, c.name, c.sortOrder);
  }
  console.log(`[seed] expense categories: ${DEFAULT_EXPENSE_CATEGORIES.length}`);

  // 6. AllocationRule shared default
  await seedAllocationRuleShared(org.id);
  console.log("[seed] allocation rule: 1");

  // 7. User owner (S1-03: Auth.js).
  // - ENV override untuk owner@kustom.local & password produksi.
  // - Hash argon2id (lihat src/lib/argon2.ts).
  // - Idempoten: bila email sudah ada, refresh hash & nama agar
  //   perubahan password di ENV langsung berlaku pada seed ulang.
  const ownerEmail = (process.env.OWNER_EMAIL ?? "owner@hillside.local").trim().toLowerCase();
  const ownerPassword = process.env.OWNER_PASSWORD ?? "he-dev-2026!";
  if (ownerPassword.length < 8) {
    throw new Error("OWNER_PASSWORD minimal 8 karakter (lihat docs/08 §3).");
  }
  const passwordHash = await hashPassword(ownerPassword);
  const existing = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  });
  if (existing) {
    await prisma.user.update({
      where: { email: ownerEmail },
      data: {
        name: "Pemilik",
        role: "OWNER",
        passwordHash,
        organizationId: org.id,
      },
    });
    console.log(`[seed] user owner diperbarui: ${ownerEmail}`);
  } else {
    await prisma.user.create({
      data: {
        email: ownerEmail,
        name: "Pemilik",
        role: "OWNER",
        passwordHash,
        organizationId: org.id,
      },
    });
    console.log(`[seed] user owner dibuat: ${ownerEmail}`);
  }

  console.log("[seed] selesai");
}

main()
  .catch((err) => {
    console.error("[seed] gagal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export {};
