/**
 * Unit test untuk Server Action Impor File OTA (S9-01).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/ingest/pipeline/pipeline", () => ({
  runIngest: vi.fn(),
}));

vi.mock("@/ingest/storage", () => ({
  createStorageProvider: vi.fn(() => ({
    put: vi.fn().mockResolvedValue({ key: "mock-storage-key" }),
  })),
}));

import { auth } from "@/auth";
import { runIngest } from "@/ingest/pipeline/pipeline";
import { revalidatePath } from "next/cache";
import { importOtaCsvAction } from "@/server/actions/import";

describe("importOtaCsvAction (S9-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("menolak jika user belum login atau sesi tidak memiliki organizationId", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const formData = new FormData();
    const result = await importOtaCsvAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Sesi tidak valid");
  });

  it("menolak jika tidak ada berkas yang diunggah atau ukuran berkas 0", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1" },
    } as never);

    const formData = new FormData();
    const result = await importOtaCsvAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Silakan pilih berkas CSV");
  });

  it("menolak jika format berkas bukan .csv", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1" },
    } as never);

    const file = new File(["dummy content"], "data.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", file);

    const result = await importOtaCsvAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Format berkas harus berekstensi .csv");
  });

  it("menolak jika ukuran berkas melebihi 10 MB", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1" },
    } as never);

    const largeFile = new File(["test"], "huge.csv", { type: "text/csv" });
    Object.defineProperty(largeFile, "size", { value: 11 * 1024 * 1024 });

    const formData = new FormData();
    formData.append("file", largeFile);

    const result = await importOtaCsvAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.message).toContain("melebihi batas maksimal");
  });

  it("berhasil memproses berkas CSV yang valid dan memanggil runIngest", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1" },
    } as never);

    vi.mocked(runIngest).mockResolvedValue({
      batchId: "batch-123",
      total: 10,
      created: 8,
      updated: 1,
      duplicate: 1,
      failed: 0,
      needsReview: 0,
      payoutsLinked: 0,
      errors: [],
    });

    const csvContent =
      "Confirmation code,Status,Guest name,Start date,End date,Earnings\nHM123,Confirmed,John,2026-11-01,2026-11-03,5000000";
    const file = new File([csvContent], "airbnb-reservations.csv", { type: "text/csv" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("channel", "AIRBNB");

    const result = await importOtaCsvAction(null, formData);

    expect(result.success).toBe(true);
    expect(result.batchId).toBe("batch-123");
    expect(result.stats?.created).toBe(8);
    expect(result.stats?.updated).toBe(1);
    expect(result.stats?.duplicate).toBe(1);
    expect(revalidatePath).toHaveBeenCalledWith("/bookings");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("menangani kegagalan total dari pipeline runIngest dengan benar", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", organizationId: "org-1" },
    } as never);

    vi.mocked(runIngest).mockResolvedValue({
      batchId: "batch-failed",
      total: 1,
      created: 0,
      updated: 0,
      duplicate: 0,
      failed: 1,
      needsReview: 0,
      payoutsLinked: 0,
      errors: [{ itemId: "item-1", code: "UNSUPPORTED_FORMAT", message: "Header tidak cocok" }],
    });

    const file = new File(["kolom_aneh,tidak_cocok"], "unknown.csv", { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("channel", "AUTO");

    const result = await importOtaCsvAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Header tidak cocok");
    expect(result.stats?.failed).toBe(1);
  });
});
