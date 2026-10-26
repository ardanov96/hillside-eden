#!/usr/bin/env tsx
/**
 * Entrypoint skrip background worker untuk Hillside Eden.
 * Perintah:
 *   pnpm worker           -> berjalan terus dengan interval default 5 menit
 *   pnpm worker --once    -> eksekusi 1 siklus lalu keluar (cocok untuk Cron / CI)
 */
import { startWorkerLoop } from "../src/worker/runner";

const args = process.argv.slice(2);
const runOnce = args.includes("--once");

let customInterval: number | undefined;
for (const arg of args) {
  if (arg.startsWith("--interval=")) {
    const val = parseInt(arg.split("=")[1] || "", 10);
    if (!isNaN(val) && val > 0) {
      customInterval = val;
    }
  }
}

startWorkerLoop({
  runOnce,
  intervalMs: customInterval,
}).catch((err) => {
  console.error("[Worker] Galat tidak tertangani:", err);
  process.exit(1);
});
