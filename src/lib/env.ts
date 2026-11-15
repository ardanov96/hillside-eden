/**
 * Validasi environment variables dengan Zod.
 * Aplikasi menolak start bila konfigurasi tidak valid.
 * Lihat docs/08 §6 untuk daftar variabel.
 *
 * Modul ini dijalankan saat boot lewat `src/instrumentation.ts` → `src/instrumentation.node.ts`
 * dan juga oleh worker (`scripts/worker.ts`), sehingga konfigurasi produksi yang
 * tidak lengkap menyebabkan proses berhenti, bukan berjalan diam-diam dengan
 * nilai default yang tidak aman (ADR-031).
 *
 * Catatan: modul ini **tidak** melakukan validasi otomatis saat diimpor —
 * validasi dipanggil eksplisit lewat `validateEnv()`/`getEnv()` supaya
 * pemanggil dapat menentukan sendiri apa yang terjadi bila konfigurasi invalid
 * (mis. menghentikan proses saat boot).
 */
import { z } from "zod";
import { hasValidProductionTrustHost } from "./auth-trust-host";

/** Panjang minimum `AUTH_SECRET` (karakter). */
export const AUTH_SECRET_MIN_LENGTH = 32;

/** Panjang minimum `ENCRYPTION_KEY` (karakter). */
export const ENCRYPTION_KEY_MIN_LENGTH = 32;

/** Placeholder dev/test — TIDAK boleh dipakai di produksi. */
const DEV_AUTH_SECRET_PLACEHOLDER = "dev-only-placeholder-auth-secret-32byte!!";

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_BASE_URL: z.string().url().default("http://localhost:3000"),
    TZ: z.string().default("Asia/Makassar"),
    Timezone: z.string().optional(),
    // Diisi Next.js saat `next build` (secret runtime belum tersedia).
    NEXT_PHASE: z.string().optional(),

    DATABASE_URL: z.string().url().optional(),
    DIRECT_DATABASE_URL: z.string().url().optional(),

    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    STORAGE_LOCAL_PATH: z.string().default("./storage"),

    INBOUND_EMAIL_DRIVER: z.enum(["none", "webhook", "imap"]).default("none"),

    WORKER_ENABLED: z
      .string()
      .default("true")
      .transform((v) => v === "true"),

    // Wajib di produksi (dicek di superRefine); optional di dev/test.
    // Lihat docs/08 §6.
    AUTH_SECRET: z.string().min(AUTH_SECRET_MIN_LENGTH).optional(),
    ENCRYPTION_KEY: z.string().min(ENCRYPTION_KEY_MIN_LENGTH).optional(),
    // URL kanonis Auth.js (ADR-032). Wajib di produksi bila
    // `AUTH_TRUST_HOST` tidak diset.
    AUTH_URL: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().url().optional(),
    ),
    // Alternatif `AUTH_URL`: Izinkan Auth.js mempercayai header `Host`
    // dari reverse proxy. Hanya bila proxy dijamin men-set Host dengan benar.
    AUTH_TRUST_HOST: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().optional(),
    ),
    OWNER_EMAIL: z.string().email().optional(),
    OWNER_PASSWORD: z.string().min(8).optional(),
  })
  .superRefine((values, ctx) => {
    if (values.NODE_ENV !== "production") return;

    // Saat `next build`, secret runtime belum tersedia; pengecekan produksi
    // dilakukan lagi ketika server benar-benar start.
    if (values.NEXT_PHASE === "phase-production-build") return;

    if (!values.AUTH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_SECRET"],
        message: `AUTH_SECRET wajib di-set di produksi (>= ${AUTH_SECRET_MIN_LENGTH} karakter).`,
      });
    }
    if (!values.ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ENCRYPTION_KEY"],
        message: `ENCRYPTION_KEY wajib di-set di produksi (>= ${ENCRYPTION_KEY_MIN_LENGTH} karakter).`,
      });
    }
    if (
      !hasValidProductionTrustHost({
        authUrl: values.AUTH_URL,
        authTrustHost: values.AUTH_TRUST_HOST,
        nodeEnv: values.NODE_ENV,
      })
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_URL"],
        message:
          "AUTH_URL wajib di-set di produksi (URL kanonis Auth.js, mis. https://domain-resmi) " +
          "atau AUTH_TRUST_HOST=true bila reverse proxy dijamin men-set header Host.",
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/**
 * Terapkan default khusus development/test.
 * - Alias `Timezone` → `TZ`.
 * - `AUTH_SECRET` placeholder bila belum ada (dev/test saja).
 */
function applyDevDefaults(): void {
  if (typeof process === "undefined") return;

  if (process.env.Timezone && !process.env.TZ) {
    process.env.TZ = process.env.Timezone;
  }

  if (process.env.NODE_ENV === "production") return;

  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < AUTH_SECRET_MIN_LENGTH) {
    // Placeholder dev/test agar Auth.js & enkripsi tidak crash saat dev.
    process.env.AUTH_SECRET = DEV_AUTH_SECRET_PLACEHOLDER;
  }
}

/**
 * Validasi environment. Melempar error bila konfigurasi tidak valid.
 * Dipakai saat boot (`src/instrumentation.node.ts`) dan oleh worker.
 */
export function validateEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

let cachedEnv: Env | undefined;

/**
 * Environment tervalidasi (memoized). Validasi baru dijalankan pada akses
 * pertama; setelah itu nilainya dipakai ulang.
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

applyDevDefaults();
