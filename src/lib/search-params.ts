/**
 * Util untuk normalisasi searchParams dari Next.js (S2-07.2).
 *
 * Di Next.js 16 (App Router) `searchParams` adalah
 * `Record<string, string | string[] | undefined>`. Untuk form filter kita
 * hanya butuh nilai tunggal per key; mengambil elemen pertama bila array.
 *
 * Sumber kebenaran docs/03-architecture.md §6 (Pemisahan responsibilities).
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Ambil nilai string tunggal dari searchParams (elemen pertama bila array). */
export function getString(params: RawSearchParams, key: string): string | undefined {
  const v = params[key];
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v[0];
  return v;
}

/**
 * Ubah searchParams menjadi plain object string-only, membuang key dengan
 * nilai kosong/undefined. Berguna saat menyalin ke URLSearchParams untuk
 * link pagination / sort.
 */
export function toQueryString(params: RawSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    const s = Array.isArray(v) ? v[0] : v;
    if (s === undefined || s === "") continue;
    out.set(k, s);
  }
  return out;
}

/** Bangun URL dengan mengganti beberapa key pada searchParams. */
export function withParams(
  base: string,
  params: RawSearchParams,
  overrides: Record<string, string | number | null | undefined>,
): string {
  const sp = toQueryString(params);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null || v === undefined || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  const q = sp.toString();
  return q.length > 0 ? `${base}?${q}` : base;
}
