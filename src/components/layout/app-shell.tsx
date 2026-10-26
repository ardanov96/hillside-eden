"use client";

/**
 * Kerangka aplikasi Dashboard Hillside Eden (Standard Web Admin Dashboard).
 *
 * Struktur:
 * - Permanent Left Admin Sidebar pada desktop (hidden md:flex md:w-64)
 * - Mobile Slide-out Navigation Drawer & Collapsible Filter Bar pada mobile (< 768px)
 * - Sticky Top Header dengan filter global toolbar pada desktop
 * - Area konten dengan kanvas berlatar soft gray dan kartu putih terangkat
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Trees, LogOut, ShieldCheck, Menu, X, Filter, ChevronDown } from "lucide-react";

import { signOutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [prevRouteKey, setPrevRouteKey] = useState(routeKey);
  if (routeKey !== prevRouteKey) {
    setPrevRouteKey(routeKey);
    setIsMobileMenuOpen(false);
    setIsMobileFilterOpen(false);
  }

  // Lock body scroll saat mobile menu terbuka
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const initial = userEmail ? userEmail.charAt(0).toUpperCase() : "H";

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-slate-50/70 text-slate-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      {/* =========================================================================
          1. PERMANENT ADMIN SIDEBAR (Desktop & Tablet md+: 768px+)
         ========================================================================= */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col h-screen sticky top-0 border-r border-slate-200/80 bg-white text-slate-900 z-30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
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

        {/* Quick Search Shortcut Box */}
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
          2. MOBILE HEADER & NAVIGATION DRAWER (< 768px: Mobile Phone)
         ========================================================================= */}
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/95 px-3.5 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95 shadow-2xs md:hidden">
        {/* Left: Hamburger & Brand */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen((prev) => !prev);
              setIsMobileFilterOpen(false);
            }}
            aria-label={isMobileMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-700 active:scale-95 transition-transform dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs dark:bg-emerald-600">
              <Trees className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold tracking-tight text-slate-900 leading-tight dark:text-white">
                Hillside Eden
              </span>
              <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider dark:text-zinc-500">
                Admin
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Filter dropdown button & Active Indicator */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsMobileFilterOpen((prev) => !prev);
              setIsMobileMenuOpen(false);
            }}
            aria-label="Buka filter global"
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-95",
              isMobileFilterOpen
                ? "border-primary bg-primary text-primary-foreground"
                : "border-slate-200/80 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filter</span>
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                isMobileFilterOpen && "rotate-180",
              )}
            />
          </button>

          <span
            title="Sistem Aktif"
            className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-950"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          </span>
        </div>
      </header>

      {/* Mobile Collapsible Filter Sheet */}
      {isMobileFilterOpen ? (
        <div className="border-b border-slate-200/80 bg-white p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900 md:hidden animate-in slide-in-from-top-2 duration-150 z-30">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-zinc-800">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Filter Portofolio &amp; Periode
            </span>
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(false)}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
            >
              Tutup
            </button>
          </div>
          <Suspense
            fallback={<div className="h-20 animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />}
          >
            <GlobalFilterBar
              properties={properties}
              isMobile
              onApplied={() => setIsMobileFilterOpen(false)}
            />
          </Suspense>
        </div>
      ) : null}

      {/* Mobile Slide-Out Drawer Navigation Backdrop */}
      {isMobileMenuOpen ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Mobile Slide-Out Drawer Navigation Panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-zinc-900 md:hidden",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Drawer Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 px-4 dark:border-zinc-800">
          <Link
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-2.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs dark:bg-emerald-600">
              <Trees className="h-4.5 w-4.5" />
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

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800"
            aria-label="Tutup menu navigasi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Search Box */}
        <div className="px-3 pt-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/80 px-2.5 py-1.5 text-xs text-slate-400 dark:border-zinc-800 dark:bg-zinc-800/50">
            <span>Cari menu...</span>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-400 shadow-2xs dark:border-zinc-700 dark:bg-zinc-900">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <Suspense
            fallback={
              <div className="h-48 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-800/40" />
            }
          >
            <NavList onNavigate={() => setIsMobileMenuOpen(false)} />
          </Suspense>
        </div>

        {/* Drawer Footer */}
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
            <span>Asia/Makassar</span>
            <span>IDR</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. MAIN CONTENT AREA (Desktop Top Header + Children Content + Footer)
         ========================================================================= */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Sticky Top Header on Desktop & Tablet */}
        <header className="sticky top-0 z-20 hidden md:flex min-h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 sm:px-6 py-2 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95 shadow-2xs gap-3 flex-wrap sm:flex-nowrap">
          {/* Global Filter Bar Toolbar */}
          <div className="flex flex-1 items-center min-w-0">
            <Suspense
              fallback={
                <div className="h-8 w-64 animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
              }
            >
              <GlobalFilterBar properties={properties} />
            </Suspense>
          </div>

          {/* Right Status Indicator */}
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/50 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sistem Aktif
            </span>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-3.5 sm:p-6 xl:p-8 min-w-0">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>

        {/* Footer */}
        <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-500 bg-white/50 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:px-6 sm:flex-row">
            <p>© 2026 Hillside Eden Management Dashboard</p>
            <p>Hillside Eden (Payangan) &amp; Ubud Hillside</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
