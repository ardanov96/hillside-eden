"use client";

/**
 * Banner Peringatan Bentrok Jadwal (Double-Booking Alert Banner).
 *
 * Mengikuti spesifikasi docs/07-ui-spec.md §3.1:
 * "Bila ada bentrok jadwal: banner peringatan dengan tautan ke Kalender."
 */
import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  AlertOctagon,
  Calendar,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Bed,
} from "lucide-react";

import type {
  DashboardCollisionResult,
  DashboardCollisionItemDto,
} from "@/server/queries/dashboard";

interface CollisionAlertBannerProps {
  collisionData: DashboardCollisionResult;
}

const CHANNEL_BADGES: Record<string, { bg: string; label: string }> = {
  AIRBNB: { bg: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300", label: "Airbnb" },
  TIKET_COM: {
    bg: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    label: "Tiket.com",
  },
  TRAVELOKA: {
    bg: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
    label: "Traveloka",
  },
  BOOKING_COM: {
    bg: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
    label: "Booking.com",
  },
  AGODA: {
    bg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    label: "Agoda",
  },
  EXPEDIA: {
    bg: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    label: "Expedia",
  },
  MANUAL: {
    bg: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
    label: "Manual",
  },
  ICAL: {
    bg: "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300",
    label: "iCal Blokir",
  },
};

export function CollisionAlertBanner({ collisionData }: CollisionAlertBannerProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Jika tidak ada bentrok keras maupun peringatan inventori, tidak menampilkan banner
  if (!collisionData.hasCollisions && !collisionData.hasWarnings) {
    return null;
  }

  const { collisions, warnings, recommendedCalendarUrl } = collisionData;

  // Kasus 1: Bentrok Keras (Double Booking CONFIRMED vs CONFIRMED / BLOCK)
  if (collisionData.hasCollisions) {
    const displayedItems = isExpanded ? collisions : collisions.slice(0, 2);
    const hiddenCount = Math.max(0, collisions.length - 2);

    return (
      <div className="relative overflow-hidden rounded-2xl border border-rose-300/80 bg-gradient-to-r from-rose-50/90 via-red-50/80 to-amber-50/60 p-4 sm:p-5 shadow-xs backdrop-blur-md dark:border-rose-900/70 dark:from-rose-950/40 dark:via-red-950/30 dark:to-amber-950/20 transition-all">
        {/* Glow Accent Background */}
        <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-rose-400/10 blur-2xl" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Sisi Kiri: Ikon & Header */}
          <div className="flex items-start gap-3.5">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 shadow-2xs dark:bg-rose-900/60 dark:text-rose-400">
              <AlertOctagon className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-600"></span>
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-rose-950 dark:text-rose-100 sm:text-base">
                  Peringatan Bentrok Jadwal (Double-Booking)
                </h2>
                <span className="inline-flex items-center rounded-full border border-rose-300 bg-rose-100/90 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                  {collisions.length} Konflik Terdeteksi
                </span>
              </div>
              <p className="text-xs text-rose-800/90 leading-relaxed dark:text-rose-300/90 max-w-2xl">
                Terdapat reservasi atau pemblokiran kamar yang saling bertumpuk pada unit dan
                rentang tanggal yang sama. Segera alokasikan ulang unit atau sesuaikan jadwal
                sebelum tanggal check-in tiba.
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Action Button */}
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
            <Link
              href={recommendedCalendarUrl}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition-colors dark:bg-rose-600 dark:hover:bg-rose-500"
            >
              <Calendar className="h-4 w-4" />
              <span>Buka di Kalender</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Daftar Insiden Bentrok */}
        <div className="mt-4 space-y-2 border-t border-rose-200/80 pt-3 dark:border-rose-900/50">
          <div className="flex items-center justify-between text-xs text-rose-900 dark:text-rose-300">
            <span className="font-semibold">Rincian Unit &amp; Tanggal Bertabrakan:</span>
            {collisions.length > 2 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center gap-1 font-semibold text-rose-700 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-200 transition-colors"
              >
                <span>{isExpanded ? "Tutup Rincian" : `Lihat Semua (${collisions.length})`}</span>
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {displayedItems.map((c) => (
              <CollisionCard key={c.id} item={c} />
            ))}
          </div>

          {!isExpanded && hiddenCount > 0 && (
            <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80 italic text-center pt-1">
              +{hiddenCount} bentrok lainnya disembunyikan. Buka Kalender Okupansi untuk navigasi
              visual menyeluruh.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Kasus 2: Hanya ada Peringatan Unit Non-Sellable (tanpa double-booking)
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold">
              Peringatan Inventori: {warnings.length} Booking pada Unit Tidak Dijual
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              Ada reservasi aktif pada unit yang status inventori-nya sedang dinonaktifkan (tidak
              dijual).
            </p>
          </div>
        </div>
        <Link
          href={recommendedCalendarUrl}
          className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors self-start sm:self-center"
        >
          <span>Tinjau Kalender</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function CollisionCard({ item }: { item: DashboardCollisionItemDto }) {
  const badgeA = CHANNEL_BADGES[item.bookingA.channel || "MANUAL"] || CHANNEL_BADGES.MANUAL!;
  const badgeB = item.bookingB
    ? CHANNEL_BADGES[item.bookingB.channel || "MANUAL"] || CHANNEL_BADGES.MANUAL!
    : CHANNEL_BADGES.ICAL!;

  return (
    <div className="rounded-xl border border-rose-200/90 bg-white/90 p-3 shadow-2xs dark:border-rose-900/50 dark:bg-zinc-900/90">
      <div className="flex items-center justify-between gap-2 border-b border-rose-100 pb-2 dark:border-zinc-800">
        <div className="flex items-center gap-1.5 min-w-0">
          <Bed className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="truncate text-xs font-bold text-slate-900 dark:text-white">
            {item.unitName}
          </span>
          {item.propertyName && (
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
              ({item.propertyName})
            </span>
          )}
        </div>
        <span className="shrink-0 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
          {item.overlapNights} malam overlap
        </span>
      </div>

      <div className="mt-2 space-y-1.5 text-xs">
        <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-zinc-400">
          <Calendar className="h-3 w-3 text-rose-500 shrink-0" />
          <span className="font-semibold text-rose-950 dark:text-rose-200">
            {item.overlapStart} s/d {item.overlapEnd}
          </span>
        </div>

        {/* Pembanding 2 entri yang bertabrakan */}
        <div className="rounded-lg bg-rose-50/50 p-2 dark:bg-zinc-800/50 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 truncate font-medium text-slate-800 dark:text-zinc-200">
              <span className={`rounded px-1.5 py-0.2 text-[9px] font-semibold ${badgeA.bg}`}>
                {badgeA.label}
              </span>
              <span className="truncate">
                {item.bookingA.guestName || item.bookingA.externalId || "Tamu A"}
              </span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 shrink-0">
              {item.bookingA.checkIn.slice(5)} - {item.bookingA.checkOut.slice(5)}
            </span>
          </div>

          <div className="text-[10px] text-center font-bold text-rose-500 dark:text-rose-400">
            ▲ bertabrakan dengan ▼
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1 truncate font-medium text-slate-800 dark:text-zinc-200">
              <span className={`rounded px-1.5 py-0.2 text-[9px] font-semibold ${badgeB.bg}`}>
                {badgeB.label}
              </span>
              <span className="truncate">
                {item.bookingB?.guestName ||
                  item.bookingB?.externalId ||
                  item.block?.summary ||
                  "Blok Kalender"}
              </span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 shrink-0">
              {item.bookingB
                ? `${item.bookingB.checkIn.slice(5)} - ${item.bookingB.checkOut.slice(5)}`
                : item.block
                  ? `${item.block.startDate.slice(5)} - ${item.block.endDate.slice(5)}`
                  : "-"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
