/**
 * Kerangka aplikasi Dashboard Hillside Eden (shadcn/ui layout standard).
 *
 * Struktur:
 * - Fixed left sidebar (md:flex md:w-64 md:fixed md:inset-y-0)
 * - Header sticky dengan filter global & profile dropdown
 * - Main content area dengan latar canvas ber-kontras
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { Trees, LogOut, ShieldCheck } from "lucide-react";

import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const initial = userEmail ? userEmail.charAt(0).toUpperCase() : "H";

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* =========================================================================
          1. FIXED LEFT SIDEBAR (Desktop: md & up)
         ========================================================================= */}
      <aside className="hidden md:fixed md:inset-y-0 md:z-30 md:flex md:w-64 md:flex-col border-r border-border bg-card">
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Trees className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-foreground">
                Hillside Eden
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Hotel & Villa Management
              </span>
            </div>
          </Link>
        </div>

        {/* Scrollable Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted/40" />}>
            <NavList />
          </Suspense>
        </div>

        {/* Sidebar Footer Info */}
        <div className="border-t border-border p-4 bg-muted/30">
          <div className="rounded-xl border border-border/70 bg-card p-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Zona Waktu</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                WITA (UTC+8)
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              Mata uang dasar: <strong className="text-foreground">IDR (Rp)</strong>
            </p>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2. MAIN WRAPPER (Offset by Sidebar on md & up)
         ========================================================================= */}
      <div className="flex flex-1 flex-col md:pl-64">
        {/* Sticky Header */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card/85 px-4 sm:px-6 backdrop-blur-md">
          {/* Mobile Brand (visible only < md) */}
          <div className="flex items-center gap-2 md:hidden">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Trees className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold text-foreground">Hillside Eden</span>
            </Link>
          </div>

          {/* Desktop Filter Bar (visible md & up) */}
          <div className="hidden md:flex md:flex-1 md:items-center">
            <Suspense fallback={<div className="h-9 w-72 animate-pulse rounded-lg bg-muted/40" />}>
              <GlobalFilterBar properties={properties} />
            </Suspense>
          </div>

          {/* User Profile Dropdown */}
          {userEmail ? (
            <div className="flex items-center gap-2 ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex h-10 items-center gap-2.5 rounded-full px-2 hover:bg-muted/60"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-2xs">
                      {initial}
                    </div>
                    <div className="hidden text-left sm:flex sm:flex-col">
                      <span className="text-xs font-semibold text-foreground leading-tight">
                        {userEmail}
                      </span>
                      <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        Owner
                      </span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60 shadow-lg">
                  <DropdownMenuLabel className="font-normal p-3">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs font-semibold text-foreground">Akun Pemilik</p>
                      <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-xs text-muted-foreground cursor-default py-2">
                    <ShieldCheck className="mr-2 h-4 w-4 text-emerald-600" />
                    <span>Role: OWNER</span>
                    <Badge variant="success" className="ml-auto text-[9px] px-1.5 py-0">
                      Aktif
                    </Badge>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <form action={signOutAction} className="w-full">
                    <button type="submit" className="w-full text-left">
                      <DropdownMenuItem className="w-full cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive py-2">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Keluar</span>
                      </DropdownMenuItem>
                    </button>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </header>

        {/* Mobile Filter Bar (visible only < md) */}
        <div className="border-b border-border bg-card p-4 md:hidden">
          <Suspense fallback={<div className="h-10 animate-pulse rounded-lg bg-muted/40" />}>
            <GlobalFilterBar properties={properties} />
          </Suspense>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground bg-card/40">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
            <p>© 2026 Hillside Eden Management Dashboard</p>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Asia/Makassar (WITA)
              </span>
              <span>·</span>
              <span>Mata uang: IDR</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
