/**
 * Daftar menu navigasi dashboard (S4-01).
 *
 * Sumber kebenaran tampilan sidebar:
 * docs/07-ui-spec.md §2 (Ringkasan · Booking · Kalender · Pengeluaran · Kas ·
 * Laporan · Perlu perhatian · Pengaturan).
 *
 * `status` menandai apakah halaman sudah live atau masih backlog.
 * Backlog dirender dalam keadaan non-interaktif (teks + label "Segera")
 * sehingga demo tidak punya link mati.
 */
export type NavStatus = "live" | "planned";

export interface NavItem {
  /** URL absolut dalam aplikasi. */
  href: string;
  /** Label UI. */
  label: string;
  /** Status implementasi halaman. */
  status: NavStatus;
  /** Tiket referensi (untuk backlog). */
  ticket?: string;
}

/** Urutan sesuai dokumen. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Ringkasan", status: "live" },
  { href: "/bookings", label: "Booking", status: "live" },
  { href: "/calendar", label: "Kalender", status: "live" },
  { href: "/expenses", label: "Pengeluaran", status: "planned", ticket: "S3-01" },
  { href: "/cash", label: "Kas", status: "live" },
  { href: "/reports", label: "Laporan", status: "live" },
  { href: "/attention", label: "Perlu perhatian", status: "live" },
  { href: "/settings", label: "Pengaturan", status: "live" },
];
