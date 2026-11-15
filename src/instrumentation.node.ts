/**
 * Validasi environment khusus runtime Node.js.
 *
 * Dipisah dari `src/instrumentation.ts` agar pemanggilan `process.exit` tidak
 * ikut ter-bundle ke varian Edge Runtime dari file instrumentation.
 *
 * Referensi: docs/08-quality-security-ops.md §6, ADR-031.
 */
import { validateEnv } from "./lib/env";

/**
 * Validasi environment; bila tidak valid, proses dihentikan (exit code 1).
 *
 * Next.js hanya *mencatat* kegagalan hook instrumentation lalu tetap menjalankan
 * server, sehingga penghentian proses dilakukan secara eksplisit di sini.
 */
export function validateEnvOrExit(): void {
  try {
    validateEnv();
  } catch (err) {
    console.error("[boot] Konfigurasi environment tidak valid — aplikasi berhenti.");
    console.error(err);
    process.exit(1);
  }
}
