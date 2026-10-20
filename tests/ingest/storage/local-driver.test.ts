/**
 * Unit test untuk LocalDriver & assertSafeKey (S2-02.1).
 * Tidak menyentuh DB; murni Node fs dan hashing.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fsp } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";

import { LocalDriver, UnsafeKeyError, assertSafeKey, resolveSafePath } from "@/ingest/storage";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "hillside-storage-"));
});

afterEach(async () => {
  await fsp.rm(tmpRoot, { recursive: true, force: true });
});

describe("assertSafeKey", () => {
  const SAFE_KEYS = [
    "inbox/2026-10/airbnb-001.csv",
    "archive/imports/airbnb/2026-10-19/HMABCD.csv",
    "single.csv",
    "a/b/c/d/e/f/g.txt",
  ];
  const UNSAFE_CASES: Array<[string, string]> = [
    ["", "kosong"],
    ["/abs/path", "leading /"],
    ["with\\back", "separator Windows"],
    ["../etc/passwd", ".."],
    ["foo/../bar", ".. di tengah"],
    ["./foo", "."],
    ["foo//bar", "segmen kosong"],
    ["foo/-leading-dash", "leading dash"],
    ["/leading", "leading slash"],
  ];

  it.each(SAFE_KEYS)("menerima key aman %s", (key) => {
    expect(() => assertSafeKey(key)).not.toThrow();
    expect(assertSafeKey(key)).toBe(key);
  });

  it.each(UNSAFE_CASES)("menolak key tidak aman: %s (%s)", (key) => {
    expect(() => assertSafeKey(key)).toThrow(UnsafeKeyError);
  });

  it("resolveSafePath menolak traversal & menghasilkan path dalam root", () => {
    const root = path.resolve("/tmp/storage");
    expect(() => resolveSafePath(root, "a/../b")).toThrow(UnsafeKeyError);
    expect(resolveSafePath(root, "foo/bar.csv")).toBe(path.join(root, "foo", "bar.csv"));
  });
});

describe("LocalDriver", () => {
  it("menulis dan membaca kembali blob dengan sha256 konsisten", async () => {
    const driver = new LocalDriver({ rootDir: tmpRoot });
    const body = "confirmation,HMABCD\namount,1500000\n";
    const result = await driver.put("inbox/2026-10/airbnb.csv", body, {
      contentType: "text/csv",
    });
    expect(result.size).toBe(Buffer.byteLength(body));
    expect(result.sha256).toBe(createHash("sha256").update(body).digest("hex"));

    const read = await driver.get("inbox/2026-10/airbnb.csv");
    expect(read.toString("utf8")).toBe(body);

    const head = await driver.head("inbox/2026-10/airbnb.csv");
    expect(head.size).toBe(result.size);
    expect(head.sha256).toBe(result.sha256);
    expect(head.contentType).toBe("text/csv");
  });

  it("exists true bila ada, false bila tidak", async () => {
    const driver = new LocalDriver({ rootDir: tmpRoot });
    await driver.put("missing.csv", "x");
    expect(await driver.exists("missing.csv")).toBe(true);
    expect(await driver.exists("nope.csv")).toBe(false);
  });

  it("delete idempotent (tidak error bila tidak ada)", async () => {
    const driver = new LocalDriver({ rootDir: tmpRoot });
    await driver.put("a.csv", "data");
    await driver.delete("a.csv");
    await expect(driver.delete("a.csv")).resolves.toBeUndefined();
    await expect(driver.delete("never-existed.csv")).resolves.toBeUndefined();
    expect(await driver.exists("a.csv")).toBe(false);
  });

  it("get melempar error bila key tidak ada", async () => {
    const driver = new LocalDriver({ rootDir: tmpRoot });
    await expect(driver.get("ghost.csv")).rejects.toThrow(/not found/);
  });

  it("menolak put dengan key tidak aman", async () => {
    const driver = new LocalDriver({ rootDir: tmpRoot });
    await expect(driver.put("../escape.txt", "x")).rejects.toThrow(UnsafeKeyError);
    await expect(driver.put("/abs.txt", "x")).rejects.toThrow(UnsafeKeyError);
  });

  it("getUrl mengembalikan local://<key> untuk diagnostik", async () => {
    const driver = new LocalDriver({ rootDir: tmpRoot });
    const url = await driver.getUrl("inbox/2026-10/a.csv");
    expect(url).toBe("local://inbox/2026-10/a.csv");
  });

  it("name diekspos sebagai 'local'", () => {
    expect(new LocalDriver({ rootDir: tmpRoot }).name).toBe("local");
  });

  it("fallback ke env LOCAL_STORAGE_DIR bila rootDir tidak diberikan", async () => {
    const oldValue = process.env.LOCAL_STORAGE_DIR;
    process.env.LOCAL_STORAGE_DIR = tmpRoot;
    try {
      const driver = new LocalDriver();
      await driver.put("env.csv", "abc");
      expect(await driver.exists("env.csv")).toBe(true);
    } finally {
      if (oldValue === undefined) delete process.env.LOCAL_STORAGE_DIR;
      else process.env.LOCAL_STORAGE_DIR = oldValue;
    }
  });
});

describe("createStorageProvider factory", () => {
  it("memilih LocalDriver bila STORAGE_DRIVER=local", async () => {
    const { createStorageProvider } = await import("@/ingest/storage");
    const provider = createStorageProvider({
      STORAGE_DRIVER: "local",
      LOCAL_STORAGE_DIR: tmpRoot,
    });
    expect(provider.name).toBe("local");
  });

  it("gagal bila STORAGE_DRIVER tidak dikenal", async () => {
    const { createStorageProvider } = await import("@/ingest/storage");
    expect(() => createStorageProvider({ STORAGE_DRIVER: "s3" })).toThrow(/driver belum didukung/);
  });

  it("default LocalDriver bila STORAGE_DRIVER kosong", async () => {
    const { createStorageProvider } = await import("@/ingest/storage");
    const provider = createStorageProvider({ LOCAL_STORAGE_DIR: tmpRoot });
    expect(provider.name).toBe("local");
  });
});
