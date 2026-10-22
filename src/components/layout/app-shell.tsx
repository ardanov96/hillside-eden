/**
 * Kerangka aplikasi (S4-01 + shadcn redesign) - Server Component.
 *
 * Elemen kerangka: header modern dengan brand & user profile dropdown,
 * sidebar dengan ikon navigasi, bilah filter global, dan area konten utama.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { Suspense } from "react";
import { Trees, LogOut, User as UserIcon } from "lucide-react";

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
    <div className="flex min-h-screen flex-col bg-background antialiased selection:bg-primary/20 selection:text-primary">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Trees className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-foreground">
                  Hillside Eden
                </span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Hotel & Villa Management
                </span>
              </div>
            </Link>
          </div>

          {userEmail ? (
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative flex h-10 items-center gap-2.5 rounded-full px-2 py-1 hover:bg-muted/60"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      {initial}
                    </div>
                    <div className="hidden text-left sm:flex sm:flex-col">
                      <span className="text-xs font-medium text-foreground leading-none">
                        {userEmail}
                      </span>
                      <span className="mt-0.5 text-[10px] text-muted-foreground">Owner</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs font-semibold leading-none text-foreground">
                        Akun Pemilik
                      </p>
                      <p className="text-[11px] leading-none text-muted-foreground">{userEmail}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-xs text-muted-foreground cursor-default">
                    <UserIcon className="mr-2 h-3.5 w-3.5" />
                    <span>Role: OWNER</span>
                    <Badge variant="success" className="ml-auto text-[9px] px-1.5 py-0">
                      Aktif
                    </Badge>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <form action={signOutAction} className="w-full">
                    <button type="submit" className="w-full">
                      <DropdownMenuItem className="w-full cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
                        <LogOut className="mr-2 h-3.5 w-3.5" />
                        <span>Keluar</span>
                      </DropdownMenuItem>
                    </button>
                  </form>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 lg:flex-row lg:px-8">
        {/* Left Sidebar */}
        <aside className="w-full shrink-0 lg:w-60">
          <div className="sticky top-24 rounded-2xl border border-border/80 bg-card p-3 shadow-xs">
            <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted/40" />}>
              <NavList />
            </Suspense>
          </div>
        </aside>

        {/* Content Area */}
        <div className="min-w-0 flex-1 space-y-6">
          <Suspense fallback={<div className="h-20 animate-pulse rounded-xl bg-muted/40" />}>
            <GlobalFilterBar properties={properties} />
          </Suspense>
          <main>{children}</main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/70 py-6 text-center text-xs text-muted-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
          <p>© 2026 Hillside Eden Management Dashboard</p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              WITA (UTC+8)
            </span>
            <span>·</span>
            <span>Mata uang dasar: IDR</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
