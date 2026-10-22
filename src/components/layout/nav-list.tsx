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
import { Badge } from "@/components/ui/badge";
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

export function NavList() {
  const currentPath = usePathname();
  const searchParams = useSearchParams();

  const selection = parseGlobalFilterSelection(Object.fromEntries(searchParams.entries()));
  const globalQs = globalFilterQueryString(selection);

  return (
    <nav aria-label="Navigasi utama" className="flex flex-col gap-1">
      <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
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
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground/45 transition-colors cursor-not-allowed select-none"
            >
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground/35" />
                <span>{item.label}</span>
              </div>
              <Badge
                variant="outline"
                className="h-4 border-dashed px-1.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/50"
              >
                Segera
              </Badge>
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
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150",
              isActive
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <div className="flex items-center gap-2.5">
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              <span>{item.label}</span>
            </div>
            {isActive ? (
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" aria-hidden="true" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
