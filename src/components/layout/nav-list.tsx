"use client";
/**
 * Daftar menu navigasi (S4-01).
 *
 * Client component untuk dua hal: `usePathname()` agar item aktif ikut
 * menyorot `/bookings/new`, dan `useSearchParams()` agar setiap link
 * membawa filter global aktif (user tidak kehilangan pilihannya saat
 * berpindah halaman).
 *
 * Data menu ada di `nav-items.ts` (modul biasa) sehingga mudah diuji dan
 * tidak menarik dependensi server ke client bundle.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { globalFilterQueryString, parseGlobalFilterSelection } from "@/lib/filters/global-filter";
import { NAV_ITEMS } from "./nav-items";

export function NavList() {
  const currentPath = usePathname();
  const searchParams = useSearchParams();

  const selection = parseGlobalFilterSelection(Object.fromEntries(searchParams.entries()));
  // Range sengaja tidak dihitung di client (butuh "hari ini" versi server).
  const globalQs = globalFilterQueryString(selection);

  return (
    <nav aria-label="Navigasi utama" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        if (item.status === "planned") {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              title={`Segera hadir${item.ticket ? ` (${item.ticket})` : ""}`}
              className="flex items-center justify-between gap-2 rounded-md border border-transparent px-3 py-2 text-sm font-medium text-zinc-400 dark:text-zinc-600"
            >
              <span>{item.label}</span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                Segera
              </span>
            </span>
          );
        }

        const isActive =
          item.href === currentPath ||
          (item.href !== "/" && currentPath.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={`${item.href}${globalQs}`}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition dark:border-emerald-700/60 dark:bg-emerald-900/40 dark:text-emerald-200"
                : "rounded-md border border-transparent px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-200 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
