/**
 * Unit test untuk prisma-tx.ts (S2-02.7).
 * Hanya logika retry/backoff yang diuji; $transaction disimulasikan dengan
 * PrismaClient palsu sehingga tidak butuh DB.
 */
import { describe, expect, it, vi } from "vitest";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  computeBackoffDelayMs,
  isRetryableError,
  withSerializableTransaction,
  withTransactionRetry,
} from "@/server/prisma-tx";

function fakePrisma(run: (tx: Prisma.TransactionClient) => Promise<unknown>): PrismaClient {
  return {
    $transaction: async () => run({} as Prisma.TransactionClient),
  } as unknown as PrismaClient;
}

/** PrismaClient yang $transaction-nya melempar error berurutan dari `errors`. */
function flakyPrisma(errors: Array<unknown>): {
  prisma: PrismaClient;
  calls: () => number;
} {
  let calls = 0;
  const prisma = {
    async $transaction(fn: unknown) {
      calls++;
      const err = errors.shift();
      if (err) throw err;
      return (fn as (tx: Prisma.TransactionClient) => Promise<unknown>)(
        {} as Prisma.TransactionClient,
      );
    },
  } as unknown as PrismaClient;
  return { prisma, calls: () => calls };
}

function prismaErr(code: string) {
  return Object.assign(new Error(`prisma ${code}`), { code });
}

const NOOP_SLEEP = async () => {};

describe("isRetryableError", () => {
  it.each(["P1001", "P1002", "P1008", "P1011", "P1017", "P2024", "P2034"])(
    "menganggap %s retryable",
    (code) => {
      expect(isRetryableError(prismaErr(code))).toBe(true);
    },
  );

  it.each(["P2002", "P2003", "P2014"])("tidak retry %s", (code) => {
    expect(isRetryableError(prismaErr(code))).toBe(false);
  });

  it("tidak retry error tanpa kode Prisma", () => {
    expect(isRetryableError(new Error("boom"))).toBe(false);
    expect(isRetryableError("bukan objek")).toBe(false);
    expect(isRetryableError(null)).toBe(false);
  });
});

describe("computeBackoffDelayMs", () => {
  it("menggunakan random=1 -> capped exponential", () => {
    const opts = { baseDelayMs: 50, maxDelayMs: 2000, random: () => 1 };
    expect(computeBackoffDelayMs(1, opts)).toBe(50);
    expect(computeBackoffDelayMs(2, opts)).toBe(100);
    expect(computeBackoffDelayMs(3, opts)).toBe(200);
  });

  it("membatasi dengan maxDelayMs", () => {
    const opts = { baseDelayMs: 50, maxDelayMs: 120, random: () => 1 };
    expect(computeBackoffDelayMs(10, opts)).toBe(120);
  });

  it("random=0 -> delay 0 (full jitter)", () => {
    const opts = { baseDelayMs: 50, maxDelayMs: 2000, random: () => 0 };
    expect(computeBackoffDelayMs(5, opts)).toBe(0);
  });

  it("deterministik dengan random konstan", () => {
    const opts = { baseDelayMs: 100, maxDelayMs: 5000, random: () => 0.5 };
    // exponential = 100 * 2^(2-1) = 200; jitter floor(0.5 * 200) = 100
    expect(computeBackoffDelayMs(2, opts)).toBe(100);
    expect(computeBackoffDelayMs(2, opts)).toBe(100);
  });
});

describe("withTransactionRetry", () => {
  it("mengembalikan hasil tanpa retry bila sukses", async () => {
    const prisma = fakePrisma(async () => "OK");
    const res = await withTransactionRetry(prisma, async () => "OK", {
      sleep: NOOP_SLEEP,
    });
    expect(res).toBe("OK");
  });

  it("retry sekali lalu sukses untuk error transient", async () => {
    const { prisma, calls } = flakyPrisma([prismaErr("P2034")]);
    const res = await withTransactionRetry(prisma, async () => "OK", {
      sleep: NOOP_SLEEP,
      random: () => 1,
    });
    expect(res).toBe("OK");
    expect(calls()).toBe(2);
  });

  it("retry sampai maxRetries lalu throw error terakhir", async () => {
    const errs = [prismaErr("P1001"), prismaErr("P1001"), prismaErr("P1001"), prismaErr("P1001")];
    const { prisma, calls } = flakyPrisma(errs);
    await expect(
      withTransactionRetry(prisma, async () => "OK", {
        maxRetries: 2,
        sleep: NOOP_SLEEP,
      }),
    ).rejects.toThrow(/P1001/);
    expect(calls()).toBe(3); // 1 percobaan + 2 retry
  });

  it("TIDAK retry unique constraint (P2002)", async () => {
    const { prisma, calls } = flakyPrisma([prismaErr("P2002"), prismaErr("P2002")]);
    await expect(
      withTransactionRetry(prisma, async () => "OK", { sleep: NOOP_SLEEP }),
    ).rejects.toThrow(/P2002/);
    expect(calls()).toBe(1);
  });

  it("memanggil onRetry dengan attempt & delayMs", async () => {
    const onRetry = vi.fn();
    const { prisma } = flakyPrisma([prismaErr("P2034")]);
    await withTransactionRetry(prisma, async () => "OK", {
      sleep: NOOP_SLEEP,
      random: () => 1,
      onRetry,
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0]?.[0]).toMatchObject({ attempt: 1, delayMs: 50 });
  });

  it("maxRetries=0 berarti tidak ada retry", async () => {
    const { prisma, calls } = flakyPrisma([prismaErr("P2034"), prismaErr("P2034")]);
    await expect(
      withTransactionRetry(prisma, async () => "OK", { maxRetries: 0, sleep: NOOP_SLEEP }),
    ).rejects.toThrow(/P2034/);
    expect(calls()).toBe(1);
  });
});

describe("withSerializableTransaction", () => {
  it("mengembalikan hasil tanpa retry bila sukses", async () => {
    const prisma = fakePrisma(async () => "OK");
    expect(await withSerializableTransaction(prisma, async () => "OK")).toBe("OK");
  });

  it("retry pada P2034 (deadlock) dengan maxRetries default 3", async () => {
    // 3 kegagalan lalu sukses pada percobaan ke-4 (1 + maxRetries 3).
    const errs = [prismaErr("P2034"), prismaErr("P2034"), prismaErr("P2034")];
    const { prisma, calls } = flakyPrisma(errs);
    const res = await withSerializableTransaction(prisma, async () => "OK", {
      sleep: NOOP_SLEEP,
    });
    expect(res).toBe("OK");
    expect(calls()).toBe(4); // 1 + 3 retry
  });

  it("TIDAK retry P2002", async () => {
    const { prisma, calls } = flakyPrisma([prismaErr("P2002"), prismaErr("P2002")]);
    await expect(
      withSerializableTransaction(prisma, async () => "OK", { sleep: NOOP_SLEEP }),
    ).rejects.toThrow(/P2002/);
    expect(calls()).toBe(1);
  });
});
