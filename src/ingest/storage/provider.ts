/**
 * Kontrak StorageProvider (S2-02, Sprint 2).
 *
 * Lapisan abstraksi untuk blob storage raw ingest (CSV/email/iCal).
 * Prod (OD-05) belum diputuskan: S3-compatible atau Supabase Storage.
 * Dev: LocalDriver yang menulis di bawah LOCAL_STORAGE_DIR.
 *
 * Invarian:
 * - Keys HARUS berupa path relatif POSIX (dipisah '/'). Tidak boleh leading '/',
 *   tidak boleh mengandung '..', dan tidak boleh absolot (diawali '/') demi
 *   keamanan path traversal (lihat LocalDriver.assertSafeKey).
 * - Driver TIDAK boleh mengasumsikan content-type; nilai byte[] adalah
 *   sumber kebenaran.
 * - put() mengembalikan { key, size, sha256, etag? }; sha256 HEX lower-case.
 */
export interface StoragePutOptions {
  /** Tipe MIME opsional; dipakai beberapa driver untuk set Content-Type. */
  contentType?: string;
  /** Metadata tambahan yang akan dikembalikan oleh head(). */
  metadata?: Record<string, string>;
}

export interface StoragePutResult {
  key: string;
  size: number;
  sha256: string;
  etag?: string;
}

export interface StorageObjectMetadata {
  key: string;
  size: number;
  contentType?: string;
  sha256?: string;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

export interface StorageProvider {
  /** Nama driver (mis. "local", "s3"). Untuk diagnostik dan logging. */
  readonly name: string;

  /** Menulis blob dari buffer/string ke key. Buat direktori induk bila perlu. */
  put(key: string, body: Buffer | string, options?: StoragePutOptions): Promise<StoragePutResult>;

  /** Membaca blob sebagai Buffer. Throw bila tidak ada. */
  get(key: string): Promise<Buffer>;

  /** Memeriksa metadata tanpa mengunduh payload. */
  head(key: string): Promise<StorageObjectMetadata>;

  /** True bila blob ada. Murah; tanpa body. */
  exists(key: string): Promise<boolean>;

  /** Menghapus blob. Idempotent: tidak error bila key tidak ada. */
  delete(key: string): Promise<void>;

  /**
   * URL untuk akses langsung (signed/un-signed sesuai driver).
   * Untuk LocalDriver kembalikan path relatif internal ("local://<key>")
   * yang tidak di-expose ke publik. Bisa undefined bila driver tidak mendukung.
   */
  getUrl?(key: string, opts?: { expiresInSeconds?: number }): Promise<string | undefined>;
}
