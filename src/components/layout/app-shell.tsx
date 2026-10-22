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
    <div className="flex min-h-screen bg-slate-50/70 text-slate-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      {/* =========================================================================
          1. PERMANENT ADMIN SIDEBAR (Matching AdminCN - sleek white sidebar)
         ========================================================================= */}
      <aside className="w-64 shrink-0 flex flex-col h-screen sticky top-0 border-r border-slate-200/80 bg-white text-slate-900 z-30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 px-5 dark:border-zinc-800">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs dark:bg-emerald-600">
              <Trees className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-slate-900 leading-tight dark:text-white">
                Hillside Eden
              </span>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider dark:text-zinc-500">
                Resort &amp; Villa Admin
              </span>
            </div>
          </Link>
        </div>

        {/* Quick Search Shortcut Box (AdminCN style) */}
        <div className="px-3 pt-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 px-2.5 py-1.5 text-xs text-slate-400 dark:border-zinc-800 dark:bg-zinc-800/50">
            <span>Cari menu...</span>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-400 shadow-2xs dark:border-zinc-700 dark:bg-zinc-900">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <Suspense
            fallback={
              <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800/40" />
            }
          >
            <NavList />
          </Suspense>
        </div>

        {/* Sidebar Footer: User Profile & Timezone */}
        <div className="border-t border-slate-200/80 p-3 bg-slate-50/60 dark:border-zinc-800 dark:bg-zinc-950/60 space-y-2">
          {userEmail ? (
            <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/90">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white shadow-xs dark:bg-emerald-600">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-900 leading-tight dark:text-white">
                    {userEmail}
                  </p>
                  <p className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium dark:text-emerald-400">
                    <ShieldCheck className="h-3 w-3 inline" />
                    <span>Owner Properti</span>
                  </p>
                </div>
              </div>

              <form action={signOutAction}>
                <button
                  type="submit"
                  title="Keluar dari akun"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition-colors dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-rose-400"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          ) : null}

          <div className="flex items-center justify-between px-2 text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
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
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95 shadow-2xs">
          {/* Global Filter Bar Toolbar */}
          <div className="flex flex-1 items-center">
            <Suspense
              fallback={
                <div className="h-8 w-64 animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
              }
            >
              <GlobalFilterBar properties={properties} />
            </Suspense>
          </div>

          {/* Right Status Indicator */}
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 ml-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/50 dark:text-emerald-300">
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
