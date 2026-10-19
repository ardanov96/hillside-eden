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
});

export type Env = z.infer<typeof EnvSchema>;

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
