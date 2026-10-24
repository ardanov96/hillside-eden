"use server";

/**
 * Server Action: Impor File CSV OTA (S9-01).
 *
 * Menerima file CSV dari unggahan pengguna, memilih adapter berdasarkan
 * deteksi otomatis atau pilihan saluran, dan mengeksekusi pipeline runIngest.
 */
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runIngest, type PipelineResult } from "@/ingest/pipeline/pipeline";
import { createRouterRegistry } from "@/ingest/pipeline/router";
import { AirbnbCsvAdapter } from "@/adapters/airbnb/csv/adapter";
import { TiketCsvAdapter } from "@/adapters/tiket/csv/adapter";
import { TravelokaCsvAdapter } from "@/adapters/traveloka/csv/adapter";
import { createStorageProvider } from "@/ingest/storage";
import type { ChannelCode, RawInput } from "@/adapters/types";

export interface ImportResultState {
  success: boolean;
  message: string;
  batchId?: string;
  channel?: string;
  stats?: {
    total: number;
    created: number;
    updated: number;
    duplicate: number;
    failed: number;
    needsReview: number;
    payoutsLinked: number;
  };
  errors?: Array<{ code: string; message: string }>;
}

export async function importOtaCsvAction(
  _prevState: ImportResultState | null,
  formData: FormData,
): Promise<ImportResultState> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return {
      success: false,
      message: "Sesi tidak valid. Silakan masuk kembali.",
    };
  }

  const organizationId = session.user.organizationId;
  const actorId = session.user.id ?? null;

  const file = formData.get("file");
  if (!file || !(file instanceof File) || file.size === 0) {
    return {
      success: false,
      message: "Silakan pilih berkas CSV yang ingin diimpor.",
    };
  }

  // Validasi ukuran berkas (maksimal 10 MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      message: "Ukuran berkas melebihi batas maksimal (10 MB).",
    };
  }

  // Validasi ekstensi
  const filename = file.name || "upload.csv";
  if (!filename.toLowerCase().endsWith(".csv")) {
    return {
      success: false,
      message: "Format berkas harus berekstensi .csv.",
    };
  }

  const selectedChannel = (formData.get("channel") as string) || "AUTO";

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (err) {
    return {
      success: false,
      message: `Gagal membaca isi berkas: ${err instanceof Error ? err.message : "Kesalahan sistem"}`,
    };
  }
  const contentBuffer = Buffer.from(arrayBuffer);

  // Simpan ke storage jika driver lokal/cloud siap
  let storageKey: string | null = null;
  try {
    const storage = createStorageProvider();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `csv-imports/${Date.now()}-${safeName}`;
    const stored = await storage.put(key, contentBuffer, {
      contentType: "text/csv",
    });
    storageKey = stored.key;
  } catch {
    // Storage opsional, jangan gagalkan proses jika driver storage belum siap
    storageKey = null;
  }

  // Konfigurasi Router berdasarkan pilihan channel
  const router = createRouterRegistry();
  if (selectedChannel === "AIRBNB") {
    router.register(new AirbnbCsvAdapter());
  } else if (selectedChannel === "TIKET_COM") {
    router.register(new TiketCsvAdapter());
  } else if (selectedChannel === "TRAVELOKA") {
    router.register(new TravelokaCsvAdapter());
  } else {
    // AUTO: Daftarkan ketiga adapter OTA
    router.register(new AirbnbCsvAdapter());
    router.register(new TiketCsvAdapter());
    router.register(new TravelokaCsvAdapter());
  }

  const rawInput: RawInput = {
    kind: "csv",
    filename,
    content: contentBuffer,
  };

  const channelCode: ChannelCode | null =
    selectedChannel === "AIRBNB" ||
    selectedChannel === "TIKET_COM" ||
    selectedChannel === "TRAVELOKA"
      ? selectedChannel
      : null;

  let result: PipelineResult;
  try {
    result = await runIngest(prisma, router, {
      organizationId,
      actorId,
      kind: "CSV",
      channel: channelCode,
      filename,
      storageKey,
      rawInput,
    });
  } catch (err) {
    return {
      success: false,
      message: `Gagal menjalankan pipeline sinkronisasi: ${err instanceof Error ? err.message : "Kesalahan sistem"}`,
    };
  }

  revalidatePath("/bookings");
  revalidatePath("/");
  revalidatePath("/cash");

  const isCompleteFailure = result.total > 0 && result.failed === result.total;
  const hasErrors = result.errors && result.errors.length > 0;

  if (isCompleteFailure) {
    return {
      success: false,
      message:
        result.errors[0]?.message ||
        "Format berkas CSV tidak dikenali atau tidak didukung oleh saluran yang dipilih.",
      batchId: result.batchId,
      stats: {
        total: result.total,
        created: result.created,
        updated: result.updated,
        duplicate: result.duplicate,
        failed: result.failed,
        needsReview: result.needsReview,
        payoutsLinked: result.payoutsLinked ?? 0,
      },
      errors: result.errors,
    };
  }

  const successMsg = `Impor selesai: ${result.created} booking baru dibuat, ${result.updated} diperbarui, ${result.duplicate} duplikat dilewati${result.needsReview > 0 ? `, ${result.needsReview} perlu perhatian` : ""}${result.payoutsLinked ? `, ${result.payoutsLinked} payout ditautkan` : ""}.`;

  return {
    success: true,
    message: successMsg,
    batchId: result.batchId,
    stats: {
      total: result.total,
      created: result.created,
      updated: result.updated,
      duplicate: result.duplicate,
      failed: result.failed,
      needsReview: result.needsReview,
      payoutsLinked: result.payoutsLinked ?? 0,
    },
    errors: hasErrors ? result.errors : undefined,
  };
}
