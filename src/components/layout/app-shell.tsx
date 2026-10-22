/**
 * Kerangka aplikasi Dashboard Hillside Eden (Standard Web Admin Dashboard).
 *
 * Struktur:
 * - Permanent Left Admin Sidebar (w-64, dark theme, full height)
 * - Top Header dengan filter global toolbar dan status sistem
 * - Area konten dengan kanvas berlatar soft gray dan kartu putih terangkat
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { Trees, LogOut, ShieldCheck } from "lucide-react";

import { signOutAction } from "@/app/actions/auth";
import { GlobalFilterBar } from "./global-filter-bar";
import { NavList } from "./nav-list";

export interface ShellProperty {
  id: string;
  name: string;
}

export interface AppShellProps {
  /** Email pengguna untuk ditampilkan di header/sidebar. */
  userEmail?: string;
  /** Properti aktif untuk dropdown filter global. */
  properties: readonly ShellProperty[];
  children: ReactNode;
}

export function AppShell({ userEmail, properties, children }: AppShellProps) {
  const initial = userEmail ? userEmail.charAt(0).toUpperCase() : "H";

  return (
    <div className="flex min-h-screen bg-zinc-100/80 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      {/* =========================================================================
          1. PERMANENT ADMIN SIDEBAR (Left Column: w-64, dark, sticky top-0 h-screen)
         ========================================================================= */}
      <aside className="w-64 shrink-0 flex flex-col h-screen sticky top-0 border-r border-zinc-800 bg-zinc-900 text-zinc-100 z-30">
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-zinc-800 px-5">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-950">
              <Trees className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-white leading-tight">
                Hillside Eden
              </span>
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                Hotel & Villa Management
              </span>
            </div>
          </Link>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-zinc-800/40" />}>
            <NavList />
          </Suspense>
        </div>

        {/* Sidebar Footer: User Profile & Timezone */}
        <div className="border-t border-zinc-800 p-3 bg-zinc-950/60 space-y-2">
          {userEmail ? (
            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/90 p-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-xs">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white leading-tight">
                    {userEmail}
                  </p>
                  <p className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                    <ShieldCheck className="h-3 w-3 inline" />
                    <span>Owner</span>
                  </p>
                </div>
              </div>

              <form action={signOutAction}>
                <button
                  type="submit"
                  title="Keluar dari akun"
                  className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-rose-400 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          ) : null}

          <div className="flex items-center justify-between px-2 text-[10px] text-zinc-500">
            <span>Asia/Makassar (WITA)</span>
            <span>Mata Uang: IDR</span>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2. MAIN CONTENT AREA (Header + Children Content + Footer)
         ========================================================================= */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/95 px-6 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95 shadow-2xs">
          {/* Global Filter Bar Toolbar */}
          <div className="flex flex-1 items-center">
            <Suspense fallback={<div className="h-8 w-64 animate-pulse rounded bg-zinc-100" />}>
              <GlobalFilterBar properties={properties} />
            </Suspense>
          </div>

          {/* Right Status Indicator */}
          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 ml-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sistem Aktif
            </span>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-500 bg-white/50 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 sm:flex-row">
            <p>© 2026 Hillside Eden Management Dashboard</p>
            <p>Hillside Eden (Payangan) &amp; Ubud Hillside</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
