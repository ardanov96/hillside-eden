/**
 * Validasi environment variables dengan Zod.
 * Aplikasi menolak start bila konfigurasi tidak valid.
 * Lihat docs/08 §6 untuk daftar variabel.
 */
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  TZ: z.string().default("Asia/Makassar"),

  DATABASE_URL: z.string().url().optional(),
  DIRECT_DATABASE_URL: z.string().url().optional(),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./storage"),

  INBOUND_EMAIL_DRIVER: z.enum(["none", "webhook", "imap"]).default("none"),

  WORKER_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v === "true"),

  // Wajib di produksi; optional di dev (placeholder digunakan).
  // Lihat docs/08 §6.
  AUTH_SECRET: z.string().min(32).optional(),
  OWNER_EMAIL: z.string().email().optional(),
  OWNER_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Pengaman: AUTH_SECRET wajib >= 32 byte di produksi.
 * Di dev (`NODE_ENV !== "production"`) placeholder 32 byte dipakai.
 */
if (
  typeof process !== "undefined" &&
  process.env.NODE_ENV === "production" &&
  (process.env.AUTH_SECRET === undefined || process.env.AUTH_SECRET.length < 32)
) {
  throw new Error("AUTH_SECRET wajib di-set di produksi (>=32 byte, base64).");
}
if (!process.env.AUTH_SECRET) {
  // Placeholder dev agar Auth.js tidak crash di lokal.
  process.env.AUTH_SECRET = "dev-only-placeholder-auth-secret-32byte!!";
}

function parseEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env = parseEnv();
