/**
 * LocalDriver: implementasi StorageProvider di atas filesystem lokal (S2-02, Sprint 2).
 *
 * - Root direktori berasal dari env LOCAL_STORAGE_DIR; default ".storage" relatif cwd.
 * - Metadata disimpan sidecar "<key>.meta.json" agar head() cepat tanpa baca body.
 * - Path traversal dijaga oleh assertSafeKey (lihat uji).
 *
 * BUKAN ditujukan untuk dipakai di production tanpa proxy/network policy:
 * driver ini hanya untuk dev dan test. Untuk prod (OD-05) akan diganti
 * driver S3-compatible (lihat src/ingest/storage/index.ts, factory).
 */
import { createHash } from "node:crypto";
import { promises as fsp, type Stats } from "node:fs";
import path from "node:path";

import type {
  StorageObjectMetadata,
  StorageProvider,
  StoragePutOptions,
  StoragePutResult,
} from "./provider";

/** Konstanta untuk nama driver ini (untuk diagnostik). */
export const LOCAL_DRIVER_NAME = "local" as const;

/** Pola key aman: segmen alfanumerik/dash/dot/underscore; tidak boleh mulai/diakhiri dot. */
const SAFE_KEY_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export class UnsafeKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeKeyError";
  }
}

/**
 * Validasi key relatif POSIX.
 * - tidak boleh kosong
 * - tidak boleh leading '/'
 * - tidak boleh segmen '..' atau '.'
 * - setiap segmen harus sesuai SAFE_KEY_SEGMENT
 * Pada Windows, pemisah '\\' akan ditolak demi portabilitas & predictable URL.
 */
export function assertSafeKey(key: string): string {
  if (typeof key !== "string" || key.length === 0) {
    throw new UnsafeKeyError("key kosong atau bukan string");
  }
  if (key.startsWith("/")) {
    throw new UnsafeKeyError(`key tidak boleh diawali '/': ${key}`);
  }
  if (key.includes("\\")) {
    throw new UnsafeKeyError(`key tidak boleh mengandung separator Windows: ${key}`);
  }
  const segments = key.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") {
      throw new UnsafeKeyError(`segmen key tidak valid: '${seg}' dalam '${key}'`);
    }
    if (!SAFE_KEY_SEGMENT.test(seg)) {
      throw new UnsafeKeyError(`segmen key tidak aman: '${seg}' dalam '${key}'`);
    }
  }
  return key;
}

/** Resolve key menjadi path absolut di bawah root. Hasil sudah dijamin ada di dalam root. */
export function resolveSafePath(rootAbs: string, key: string): string {
  const safeKey = assertSafeKey(key);
  const target = path.resolve(rootAbs, safeKey);
  const rootWithSep = rootAbs.endsWith(path.sep) ? rootAbs : rootAbs + path.sep;
  if (target !== rootAbs && !target.startsWith(rootWithSep)) {
    throw new UnsafeKeyError(`key di luar root: ${key}`);
  }
  return target;
}

interface MetaSidecar {
  key: string;
  size: number;
  sha256: string;
  contentType?: string;
  lastModified: string;
  metadata?: Record<string, string>;
}

function sha256(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readMetaIfExists(p: string): Promise<MetaSidecar | null> {
  try {
    const raw = await fsp.readFile(p, "utf8");
    return JSON.parse(raw) as MetaSidecar;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function statSafe(p: string): Promise<Stats | null> {
  try {
    return await fsp.stat(p);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export interface LocalDriverOptions {
  /** Path absolut ke direktori root. Bila tidak diberikan, gunakan env atau default. */
  rootDir?: string;
}

export class LocalDriver implements StorageProvider {
  readonly name = LOCAL_DRIVER_NAME;
  readonly rootDir: string;

  constructor(opts: LocalDriverOptions = {}) {
    const candidate =
      opts.rootDir ?? process.env.LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), ".storage");
    this.rootDir = path.resolve(/*turbopackIgnore: true*/ candidate);
  }

  /** Path absolut ke blob (sudah dijamin aman). */
  private objectPath(key: string): string {
    return resolveSafePath(this.rootDir, key);
  }

  /** Sidecar metadata, namanya "<basename>.meta.json" di direktori yang sama. */
  private metaPath(key: string): string {
    const obj = this.objectPath(key);
    const dir = path.dirname(obj);
    const base = path.basename(obj);
    return path.join(dir, `${base}.meta.json`);
  }

  async put(
    key: string,
    body: Buffer | string,
    options: StoragePutOptions = {},
  ): Promise<StoragePutResult> {
    const objPath = this.objectPath(key);
    await ensureDir(path.dirname(objPath));
    const buf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    const hash = sha256(buf);
    await fsp.writeFile(objPath, buf);
    const meta: MetaSidecar = {
      key,
      size: buf.length,
      sha256: hash,
      lastModified: new Date().toISOString(),
      ...(options.contentType ? { contentType: options.contentType } : {}),
      ...(options.metadata ? { metadata: options.metadata } : {}),
    };
    await ensureDir(path.dirname(this.metaPath(key)));
    await fsp.writeFile(this.metaPath(key), JSON.stringify(meta, null, 2), "utf8");
    return { key, size: buf.length, sha256: hash };
  }

  async get(key: string): Promise<Buffer> {
    const objPath = this.objectPath(key);
    const exists = await fileExists(objPath);
    if (!exists) {
      throw new Error(`Storage object not found: ${key}`);
    }
    return fsp.readFile(objPath);
  }

  async head(key: string): Promise<StorageObjectMetadata> {
    const objPath = this.objectPath(key);
    const st = await statSafe(objPath);
    if (!st) {
      throw new Error(`Storage object not found: ${key}`);
    }
    const meta = await readMetaIfExists(this.metaPath(key));
    return {
      key,
      size: meta?.size ?? st.size,
      contentType: meta?.contentType,
      sha256: meta?.sha256,
      lastModified: meta?.lastModified ? new Date(meta.lastModified) : st.mtime,
      metadata: meta?.metadata,
    };
  }

  async exists(key: string): Promise<boolean> {
    const objPath = this.objectPath(key);
    return fileExists(objPath);
  }

  async delete(key: string): Promise<void> {
    const objPath = this.objectPath(key);
    const meta = this.metaPath(key);
    // Idempotent:ENOENT diabaikan.
    await Promise.all([fsp.rm(objPath, { force: true }), fsp.rm(meta, { force: true })]);
  }

  async getUrl(key: string): Promise<string> {
    // LocalDriver tidak expose URL publik. Audit/log hanya.
    return `local://${assertSafeKey(key)}`;
  }
}
