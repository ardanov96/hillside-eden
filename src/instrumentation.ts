/**
 * Hook boot Next.js 16 (file convention `instrumentation.ts`).
 *
 * `register()` dipanggil sekali ketika instance server Next.js dimulai, dan
 * harus selesai sebelum server melayani request. Di sini environment divalidasi
 * sehingga konfigurasi produksi yang tidak lengkap (mis. `ENCRYPTION_KEY` atau
 * `AUTH_SECRET` hilang) menyebabkan proses berhenti saat start — bukan berjalan
 * dengan nilai default yang tidak aman.
 *
 * Hanya runtime Node.js yang divalidasi; runtime edge tidak punya akses env.
 * Implementasi Node.js berada di `src/instrumentation.node.ts` agar
 * `process.exit` tidak ter-bundle ke varian Edge Runtime.
 *
 * Referensi: docs/08-quality-security-ops.md §6, ADR-031.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { validateEnvOrExit } = await import("./instrumentation.node");
  validateEnvOrExit();
}
