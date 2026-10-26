"use client";
/**
 * Daftar menu navigasi (S4-01 + shadcn redesign).
 *
 * Client component: membaca usePathname() dan useSearchParams()
 * agar pilihan filter global tetap terbawa saat navigasi antar menu.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Receipt,
  Wallet,
  FileBarChart,
  AlertCircle,
  Settings,
  type LucideIcon,
} from "lucide-react";

import { globalFilterQueryString, parseGlobalFilterSelection } from "@/lib/filters/global-filter";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavItem } from "./nav-items";

const ICON_MAP: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/bookings": BookOpen,
  "/calendar": Calendar,
  "/expenses": Receipt,
  "/cash": Wallet,
  "/reports": FileBarChart,
  "/attention": AlertCircle,
  "/settings": Settings,
};

export interface NavListProps {
  onNavigate?: () => void;
}

export function NavList({ onNavigate }: NavListProps = {}) {
  const currentPath = usePathname();
  const searchParams = useSearchParams();

  const selection = parseGlobalFilterSelection(Object.fromEntries(searchParams.entries()));
  const globalQs = globalFilterQueryString(selection);

  return (
    <nav aria-label="Navigasi utama" className="flex flex-col gap-1">
      <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
        Menu Utama
      </div>
      {NAV_ITEMS.map((item: NavItem) => {
        const Icon = ICON_MAP[item.href] ?? BookOpen;

        if (item.status === "planned") {
          return (
            <div
              key={item.href}
              aria-disabled="true"
              title={`Segera hadir${item.ticket ? ` (${item.ticket})` : ""}`}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 cursor-not-allowed select-none dark:text-zinc-600"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-600" />
                <span>{item.label}</span>
              </div>
              <span className="rounded-md border border-slate-200/80 bg-slate-100/70 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-slate-400 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-500">
                Segera
              </span>
            </div>
          );
        }

        const isActive =
          item.href === currentPath ||
          (item.href !== "/" && currentPath.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={`${item.href}${globalQs}`}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-150 active:scale-[0.98]",
              isActive
                ? "bg-slate-100 text-slate-900 font-semibold shadow-2xs dark:bg-zinc-800 dark:text-white"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-white",
            )}
          >
            <div className="flex items-center gap-3">
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive
                    ? "text-slate-900 dark:text-white"
                    : "text-slate-400 group-hover:text-slate-700 dark:text-zinc-500 dark:group-hover:text-zinc-300",
                )}
              />
              <span>{item.label}</span>
            </div>
            {isActive ? (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
