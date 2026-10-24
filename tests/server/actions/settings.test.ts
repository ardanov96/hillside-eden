/**
 * Unit test untuk Server Actions Pengaturan Feed iCal (S9-02).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    listing: {
      findFirst: vi.fn(),
    },
    icalFeed: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/adapters/ical/ssrf", () => ({
  validateSsrfSafeUrl: vi.fn().mockResolvedValue({
    validUrl: new URL("https://airbnb.com/calendar.ics"),
    resolvedIp: "1.2.3.4",
  }),
}));

vi.mock("@/adapters/ical/fetcher", () => ({
  fetchAndParseIcal: vi.fn().mockResolvedValue({
    events: [
      {
        uid: "evt-1",
        startDate: "2026-11-01",
        endDate: "2026-11-03",
        summary: "Reserved",
      },
    ],
    rawContent: "BEGIN:VCALENDAR...",
  }),
  syncIcalToListing: vi.fn().mockResolvedValue({
    listingId: "listing-1",
    totalParsed: 1,
    upsertedCount: 1,
    errors: [],
  }),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validateSsrfSafeUrl } from "@/adapters/ical/ssrf";
import { fetchAndParseIcal, syncIcalToListing } from "@/adapters/ical/fetcher";
import { revalidatePath } from "next/cache";
import {
  saveListingIcalAction,
  syncListingIcalNowAction,
  deleteListingIcalAction,
} from "@/server/actions/settings";

describe("Settings iCal Actions (S9-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveListingIcalAction", () => {
    it("menolak jika user belum login", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const result = await saveListingIcalAction({
        listingId: "listing-1",
        icalUrl: "https://example.com/cal.ics",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Sesi tidak valid");
    });

    it("menolak jika URL kosong atau bukan format valid", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
      } as never);

      const emptyRes = await saveListingIcalAction({
        listingId: "listing-1",
        icalUrl: "",
      });
      expect(emptyRes.success).toBe(false);

      const invalidRes = await saveListingIcalAction({
        listingId: "listing-1",
        icalUrl: "bukan-url",
      });
      expect(invalidRes.success).toBe(false);
    });

    it("menolak jika URL melanggar aturan proteksi SSRF", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
      } as never);

      vi.mocked(validateSsrfSafeUrl).mockRejectedValueOnce(new Error("Private IP"));

      const result = await saveListingIcalAction({
        listingId: "listing-1",
        icalUrl: "http://127.0.0.1/cal.ics",
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("proteksi SSRF");
    });

    it("berhasil menyimpan URL terenkripsi dan melakukan sinkronisasi awal", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
      } as never);

      vi.mocked(prisma.listing.findFirst).mockResolvedValue({
        id: "listing-1",
        name: "Hillside Suite",
      } as never);

      vi.mocked(prisma.icalFeed.findFirst).mockResolvedValue(null as never);

      const result = await saveListingIcalAction({
        listingId: "listing-1",
        icalUrl: "https://airbnb.com/calendar.ics?key=secret",
      });

      expect(result.success).toBe(true);
      expect(prisma.icalFeed.create).toHaveBeenCalled();
      expect(fetchAndParseIcal).toHaveBeenCalledWith("https://airbnb.com/calendar.ics?key=secret");
      expect(syncIcalToListing).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/settings");
    });
  });

  describe("syncListingIcalNowAction", () => {
    it("berhasil melakukan sinkronisasi on-demand untuk listing yang memiliki feed", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
      } as never);

      vi.mocked(prisma.listing.findFirst).mockResolvedValue({
        id: "listing-1",
        icalFeeds: [
          {
            id: "feed-1",
            urlEncrypted: "https://airbnb.com/calendar.ics",
          },
        ],
      } as never);

      const result = await syncListingIcalNowAction("listing-1");

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(fetchAndParseIcal).toHaveBeenCalled();
      expect(syncIcalToListing).toHaveBeenCalled();
    });

    it("menolak jika listing belum memiliki URL feed", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
      } as never);

      vi.mocked(prisma.listing.findFirst).mockResolvedValue({
        id: "listing-1",
        icalFeeds: [],
      } as never);

      const result = await syncListingIcalNowAction("listing-1");

      expect(result.success).toBe(false);
      expect(result.message).toContain("belum memiliki URL feed");
    });
  });

  describe("deleteListingIcalAction", () => {
    it("berhasil menghapus feed iCal listing", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: "user-1", organizationId: "org-1" },
      } as never);

      vi.mocked(prisma.listing.findFirst).mockResolvedValue({
        id: "listing-1",
      } as never);

      const result = await deleteListingIcalAction("listing-1");

      expect(result.success).toBe(true);
      expect(prisma.icalFeed.deleteMany).toHaveBeenCalledWith({
        where: { listingId: "listing-1" },
      });
      expect(revalidatePath).toHaveBeenCalledWith("/settings");
    });
  });
});
