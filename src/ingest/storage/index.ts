/**
 * Modul storage: kontrak + driver + factory (S2-02, Sprint 2).
 *
 * Memilih driver berdasarkan env STORAGE_DRIVER. Saat ini hanya "local"
 * yang tersedia; "s3" (OD-05) akan ditambahkan kemudian.
 */
import type { StorageProvider } from "./provider";
import { LocalDriver, LOCAL_DRIVER_NAME } from "./local-driver";

export * from "./provider";
export {
  LocalDriver,
  LOCAL_DRIVER_NAME,
  UnsafeKeyError,
  assertSafeKey,
  resolveSafePath,
  type LocalDriverOptions,
} from "./local-driver";

/** Konstanta env yang dikenali. */
export const STORAGE_DRIVER_ENV = "STORAGE_DRIVER" as const;
export const LOCAL_STORAGE_DIR_ENV = "LOCAL_STORAGE_DIR" as const;

/**
 * Factory provider. Pilih driver sesuai env STORAGE_DRIVER.
 * Default: "local". TBD dengan util pengujian.
 */
export function createStorageProvider(
  env: Record<string, string | undefined> = process.env,
): StorageProvider {
  const driver = (env[STORAGE_DRIVER_ENV] ?? LOCAL_DRIVER_NAME).toLowerCase();
  switch (driver) {
    case LOCAL_DRIVER_NAME:
      return new LocalDriver();
    default:
      throw new Error(`Storage driver belum didukung: '${driver}' (OD-05)`);
  }
}
