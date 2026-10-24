"use server";

/**
 * Server Actions untuk Pengaturan Listing & Feed iCal (S9-02).
 *
 * Mengelola URL feed iCal per listing, enkripsi URL rahasia,
 * proteksi SSRF, dan pemicu sinkronisasi manual/on-demand.
 */
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptText, decryptText } from "@/lib/crypto";
import { validateSsrfSafeUrl } from "@/adapters/ical/ssrf";
import { fetchAndParseIcal, syncIcalToListing } from "@/adapters/ical/fetcher";

export interface SettingsActionResult {
  success: boolean;
  message: string;
  count?: number;
}

/**
 * Simpan atau perbarui URL feed iCal untuk sebuah listing dan lakukan sinkronisasi awal.
 */
export async function saveListingIcalAction(input: {
  listingId: string;
  icalUrl: string;
}): Promise<SettingsActionResult> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Sesi tidak valid. Silakan masuk kembali." };
  }
  const organizationId = session.user.organizationId;

  const { listingId, icalUrl } = input;
  const trimmedUrl = (icalUrl || "").trim();

  if (!trimmedUrl) {
    return { success: false, message: "URL feed iCal tidak boleh kosong." };
  }

  // 1. Validasi URL dan proteksi SSRF
  try {
    const parsed = new URL(trimmedUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { success: false, message: "Protokol URL harus http atau https." };
    }
  } catch {
    return { success: false, message: "Format URL feed iCal tidak valid." };
  }

  try {
    await validateSsrfSafeUrl(trimmedUrl);
  } catch (ssrfErr) {
    return {
      success: false,
      message: `URL tidak diizinkan (proteksi SSRF): ${(ssrfErr as Error).message}`,
    };
  }

  // 2. Pastikan listing milik organisasi pengguna
  const listing = await prisma.listing.findFirst({
    where: { id: listingId, organizationId },
    select: { id: true, name: true },
  });
  if (!listing) {
    return { success: false, message: "Listing tidak ditemukan atau tidak tersedia." };
  }

  // 3. Enkripsi URL sebelum disimpan (urlEncrypted)
  const urlEncrypted = encryptText(trimmedUrl);

  const existingFeed = await prisma.icalFeed.findFirst({
    where: { listingId },
    select: { id: true },
  });

  if (existingFeed) {
    await prisma.icalFeed.update({
      where: { id: existingFeed.id },
      data: {
        urlEncrypted,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.icalFeed.create({
      data: {
        listingId,
        urlEncrypted,
      },
    });
  }

  // 4. Lakukan sinkronisasi awal secara langsung
  try {
    const { events } = await fetchAndParseIcal(trimmedUrl);
    const syncRes = await syncIcalToListing(prisma, listingId, events);

    await prisma.icalFeed.updateMany({
      where: { listingId },
      data: {
        lastFetchedAt: new Date(),
        lastStatus: `SUCCESS: ${syncRes.upsertedCount} blok kalender disinkronkan`,
      },
    });

    revalidatePath("/settings");
    revalidatePath("/calendar");

    return {
      success: true,
      count: syncRes.upsertedCount,
      message: `URL iCal berhasil disimpan & ${syncRes.upsertedCount} blok kalender disinkronkan.`,
    };
  } catch (fetchErr) {
    const errMessage = (fetchErr as Error).message;
    await prisma.icalFeed.updateMany({
      where: { listingId },
      data: {
        lastStatus: `FAILED: ${errMessage}`,
      },
    });

    revalidatePath("/settings");
    return {
      success: true,
      message: `URL iCal tersimpan, namun sinkronisasi awal gagal: ${errMessage}`,
    };
  }
}

/**
 * Pemicu sinkronisasi manual feed iCal untuk sebuah listing.
 */
export async function syncListingIcalNowAction(listingId: string): Promise<SettingsActionResult> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Sesi tidak valid. Silakan masuk kembali." };
  }
  const organizationId = session.user.organizationId;

  const listing = await prisma.listing.findFirst({
    where: { id: listingId, organizationId },
    include: {
      icalFeeds: {
        take: 1,
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!listing) {
    return { success: false, message: "Listing tidak ditemukan." };
  }

  const feed = listing.icalFeeds[0];
  if (!feed || !feed.urlEncrypted) {
    return { success: false, message: "Listing belum memiliki URL feed iCal yang dikonfigurasi." };
  }

  const plainUrl = decryptText(feed.urlEncrypted);
  if (!plainUrl) {
    return { success: false, message: "Gagal mendekripsi URL feed iCal." };
  }

  try {
    const { events } = await fetchAndParseIcal(plainUrl);
    const syncRes = await syncIcalToListing(prisma, listingId, events);

    await prisma.icalFeed.update({
      where: { id: feed.id },
      data: {
        lastFetchedAt: new Date(),
        lastStatus: `SUCCESS: ${syncRes.upsertedCount} blok kalender disinkronkan`,
      },
    });

    revalidatePath("/settings");
    revalidatePath("/calendar");

    return {
      success: true,
      count: syncRes.upsertedCount,
      message: `Sinkronisasi berhasil: ${syncRes.upsertedCount} blok kalender diperbarui.`,
    };
  } catch (err) {
    const errMessage = (err as Error).message;
    await prisma.icalFeed.update({
      where: { id: feed.id },
      data: {
        lastStatus: `FAILED: ${errMessage}`,
      },
    });

    revalidatePath("/settings");
    return {
      success: false,
      message: `Sinkronisasi gagal: ${errMessage}`,
    };
  }
}

/**
 * Hapus konfigurasi feed iCal dari sebuah listing.
 */
export async function deleteListingIcalAction(listingId: string): Promise<SettingsActionResult> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { success: false, message: "Sesi tidak valid. Silakan masuk kembali." };
  }
  const organizationId = session.user.organizationId;

  const listing = await prisma.listing.findFirst({
    where: { id: listingId, organizationId },
    select: { id: true },
  });

  if (!listing) {
    return { success: false, message: "Listing tidak ditemukan." };
  }

  await prisma.icalFeed.deleteMany({
    where: { listingId },
  });

  revalidatePath("/settings");
  revalidatePath("/calendar");

  return {
    success: true,
    message: "Konfigurasi feed iCal berhasil dihapus.",
  };
}
