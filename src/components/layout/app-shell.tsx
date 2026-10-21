/**
 * Kerangka aplikasi (S4-01) - Server Component.
 *
 * Elemen kerangka yang dipakai ulang seluruh halaman: header, navigasi,
 * bilah filter global, dan satu-satunya `<main>`.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";

import { signOutAction } from "@/app/actions/auth";
import { GlobalFilterBar } from "./global-filter-bar";
import { NavList } from "./nav-list";

export interface ShellProperty {
  id: string;
  name: string;
}

export interface AppShellProps {
  /** Email pengguna untuk ditampilkan di header. */
  userEmail?: string;
  /** Properti aktif untuk dropdown filter global. */
  properties: readonly ShellProperty[];
  children: ReactNode;
}

export function AppShell({ userEmail, properties, children }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            Hillside Eden
            <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">Dashboard</span>
          </Link>
          {userEmail ? (
            <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="hidden sm:inline">{userEmail}</span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Keluar
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
        <aside className="w-full shrink-0 lg:w-56">
          <Suspense fallback={<div className="h-48" aria-hidden="true" />}>
            <NavList />
          </Suspense>
        </aside>

        <div className="min-w-0 flex-1">
          <Suspense fallback={<div className="h-24" aria-hidden="true" />}>
            <GlobalFilterBar properties={properties} />
          </Suspense>
          <main className="mt-6">{children}</main>
        </div>
      </div>

      <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        Zona waktu Asia/Makassar (WITA) &middot; Mata uang dasar IDR
      </footer>
    </div>
  );
}
