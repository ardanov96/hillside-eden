/**
 * Rate limiter sederhana untuk endpoint sensitif (P2-9).
 *
 * Menggunakan memori dalam proses (in-memory). Untuk deploy multi-instance
 * (serverless/K8S), ganti backend penyimpanan dengan Redis/DB yang sama; antarmuka
 * `increment` / `consume` dirancang agar mudah dipindahkan.
 *
 * Model: fixed-window counter per kunci. Bila jumlah percobaan dalam window
 * melebihi batas, request ditolak hingga window reset.
 */
import { createHash } from "node:crypto";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  maxAttempts: number;
}

/** Hash kunci agar tidak menyimpan identitas mentah (email/IP) dalam memori. */
function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export class RateLimiter {
  private windowMs: number;
  private maxAttempts: number;
  // key -> { count, windowStart }
  private store = new Map<string, { count: number; windowStart: number }>();

  constructor(options: RateLimitOptions) {
    this.windowMs = options.windowMs;
    this.maxAttempts = options.maxAttempts;
  }

  /**
   * Catat satu percobaan dan tentukan apakah masih diizinkan.
   * Mengembalikan { allowed, remaining, resetAt }.
   */
  consume(key: string): RateLimitResult {
    const now = Date.now();
    const hashed = hashKey(key);
    const entry = this.store.get(hashed);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      // Window baru
      this.store.set(hashed, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: Math.max(0, this.maxAttempts - 1),
        resetAt: now + this.windowMs,
      };
    }

    const nextCount = entry.count + 1;
    entry.count = nextCount;
    const allowed = nextCount <= this.maxAttempts;
    return {
      allowed,
      remaining: Math.max(0, this.maxAttempts - nextCount),
      resetAt: entry.windowStart + this.windowMs,
    };
  }

  /** Reset counter untuk kunci (mis. setelah login berhasil). */
  reset(key: string): void {
    this.store.delete(hashKey(key));
  }

  /** Bersihkan entri window yang sudah kadaluarsa (panggil secara berkala). */
  gc(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.windowStart >= this.windowMs) {
        this.store.delete(key);
      }
    }
  }
}

/** Pelindung login: maksimal 5 percobaan gagal per 15 menit per email. */
export const loginRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 5,
});

/** Membersihkan window lama setiap 5 menit. */
setInterval(() => loginRateLimiter.gc(), 5 * 60 * 1000);
