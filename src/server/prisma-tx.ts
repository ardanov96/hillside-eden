/**
 * Helper transaksi Prisma dengan retry (S2-02.7).
 *
 * Sumber kebenaran: docs/08 §3 (reliability), docs/03 §3.1 (pipeline memakai
 * transaksi DB).
 *
 * Mengapa perlu retry:
 * - Postgres dapat memutus koneksi idle (server timeout) sehingga transaksi
 *   pertama setelah idle gagal dengan P1001/P1017.
 * - Deadlock (P2034) pada workload ingest paralel dapat terjadi; Prisma
 *   mendokumentasikan retry untuk kode P2034.
 *
 * Prinsip:
 * - Backoff eksponensial + jitter agar tidak thundering herd.
 * - HANYA retry error transient. Unique constraint (P2002) TIDAK di-retry
 *   (memang duplikat -> ditangani caller lewat idempotency).
 * - Callback harus idempoten (transactional retry butuh itu).
 */
import type { Prisma, PrismaClient } from "@prisma/client";

/** Kode error Prisma yang layak di-retry. */
export const RETRYABLE_PRISMA_CODES = new Set([
  "P1001", // can't reach database server
  "P1002", // server reached but timed out
  "P1008", // operation timed out
  "P1011", // TLS connection error
  "P1017", // server has closed the connection
  "P2024", // timed out fetching a connection from the pool
  "P2034", // write conflict / deadlock; documented as retryable
]);

/** Kode error Prisma yang SENGAJA tidak di-retry. */
export const NON_RETRYABLE_PRISMA_CODES = new Set([
  "P2002", // unique constraint violation -> duplikat, bukan transient
  "P2003", // foreign key constraint failed
  "P2014", // required relation missing
]);

export interface TxRetryOptions {
  /** Jumlah percobaan TAMBAHAN setelah percobaan pertama gagal. Default 2. */
  maxRetries?: number;
  /** Basis backoff (ms). Default 50. */
  baseDelayMs?: number;
  /** Batas atas backoff (ms). Default 2000. */
  maxDelayMs?: number;
  /** Fungsi sleep (injectable agar test cepat & deterministik). */
  sleep?: (ms: number) => Promise<void>;
  /** RNG 0..1 injectable untuk jitter deterministik di test. */
  random?: () => number;
  /** Callback untuk logging retry (default: tidak ada agar senyap di produksi). */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True bila error Prisma layak di-retry. */
export function isRetryableError(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code !== "string") return false;
  if (NON_RETRYABLE_PRISMA_CODES.has(code)) return false;
  return RETRYABLE_PRISMA_CODES.has(code);
}

/**
 * Hitung delay backoff eksponensial + full jitter.
 * Deterministik bila `random` disuplai (test).
 */
export function computeBackoffDelayMs(
  attempt: number,
  opts: { baseDelayMs: number; maxDelayMs: number; random: () => number },
): number {
  const exponential = opts.baseDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(exponential, opts.maxDelayMs);
  // Full jitter: distributed di [0, capped] agar retry tidak serempak.
  return Math.floor(opts.random() * capped);
}

/**
 * Jalankan `fn` di dalam transaksi Prisma dengan retry untuk error transient.
 *
 * @param prisma PrismaClient
 * @param fn Callback yang menerima TransactionClient. WAJIB idempoten.
 */
export async function withTransactionRetry<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TxRetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 50;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        timeout: 15_000,
        maxWait: 5_000,
      });
    } catch (err) {
      lastError = err;
      const canRetry = attempt <= maxRetries && isRetryableError(err);
      if (!canRetry) throw err;
      const delayMs = computeBackoffDelayMs(attempt, { baseDelayMs, maxDelayMs, random });
      options.onRetry?.({ attempt, delayMs, error: err });
      await sleep(delayMs);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("withTransactionRetry gagal tanpa error info");
}

/**
 * Jalankan `fn` di dalam transaksi dengan IsolationLevel Serializable bila
 * diperlukan untuk mencegah write-skew pada alokasi unit.
 *
 * Catatan: Serializable dapat memicu P2034 lebih sering; pairing dengan
 * withTransactionRetry menghasilkan perilaku yang benar (retry idempoten).
 */
export async function withSerializableTransaction<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TxRetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 50;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: "Serializable",
        timeout: 15_000,
        maxWait: 5_000,
      });
    } catch (err) {
      lastError = err;
      const canRetry = attempt <= maxRetries && isRetryableError(err);
      if (!canRetry) throw err;
      const delayMs = computeBackoffDelayMs(attempt, { baseDelayMs, maxDelayMs, random });
      options.onRetry?.({ attempt, delayMs, error: err });
      await sleep(delayMs);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("withSerializableTransaction gagal tanpa error info");
}
