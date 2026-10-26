"use client";

/**
 * Komponen Tampilan Kalender Okupansi & Deteksi Bentrok (S10-01).
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Bed,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CalendarDataResult, CalendarDayCell } from "@/server/queries/calendar";
import { BookingModal } from "./booking-modal";

interface CalendarViewProps {
  data: CalendarDataResult;
  propertyOptions: Array<{ id: string; name: string }>;
  selectedPropertyId?: string | null;
}

const CHANNEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  AIRBNB: {
    bg: "bg-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-700",
    text: "text-white",
    border: "border-rose-400",
  },
  TIKET_COM: {
    bg: "bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700",
    text: "text-white",
    border: "border-blue-400",
  },
  TRAVELOKA: {
    bg: "bg-cyan-600 hover:bg-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-700",
    text: "text-white",
    border: "border-cyan-400",
  },
  MANUAL: {
    bg: "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700",
    text: "text-white",
    border: "border-emerald-400",
  },
};

export function CalendarView({ data, propertyOptions, selectedPropertyId }: CalendarViewProps) {
  const router = useRouter();
  const [selectedCell, setSelectedCell] = React.useState<CalendarDayCell | null>(null);
  const [selectedUnitName, setSelectedUnitName] = React.useState<string>("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const { year, month, monthLabel, daysInMonth, properties, collisionReport, stats } = data;

  const navigateMonth = (offset: number) => {
    let nextMonth = month + offset;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    const params = new URLSearchParams();
    params.set("year", String(nextYear));
    params.set("month", String(nextMonth));
    if (selectedPropertyId) {
      params.set("propertyId", selectedPropertyId);
    }
    router.push(`/calendar?${params.toString()}`);
  };

  const handlePropertyChange = (newPropId: string) => {
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("month", String(month));
    if (newPropId !== "ALL") {
      params.set("propertyId", newPropId);
    }
    router.push(`/calendar?${params.toString()}`);
  };

  const handleCellClick = (cell: CalendarDayCell, unitName: string) => {
    setSelectedCell(cell);
    setSelectedUnitName(unitName);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Bilah Kontrol Kalender */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-card shadow-xs">
        {/* Navigasi Bulan */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigateMonth(-1)}
            className="h-8 w-8"
            title="Bulan sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2 px-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            <span className="text-base font-bold text-foreground">{monthLabel}</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigateMonth(1)}
            className="h-8 w-8"
            title="Bulan berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const now = new Date();
              const params = new URLSearchParams();
              params.set("year", String(now.getFullYear()));
              params.set("month", String(now.getMonth() + 1));
              if (selectedPropertyId) params.set("propertyId", selectedPropertyId);
              router.push(`/calendar?${params.toString()}`);
            }}
            className="text-xs h-8 text-muted-foreground hover:text-foreground"
          >
            Bulan Ini
          </Button>
        </div>

        {/* Filter Properti */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Properti:</span>
          <Select value={selectedPropertyId || "ALL"} onValueChange={handlePropertyChange}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Semua Properti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">
                Semua Properti
              </SelectItem>
              {propertyOptions.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Banner Peringatan Bentrok Jadwal (Jika Ada) */}
      {collisionReport.hasCollisions && (
        <div className="rounded-xl border border-red-300 bg-red-50/80 dark:border-red-900/60 dark:bg-red-950/30 p-4 text-red-950 dark:text-red-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-red-700 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <span>
              Perhatian: Terdeteksi {collisionReport.collisions.length} Bentrok Jadwal (Double
              Booking)
            </span>
          </div>
          <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed">
            Dua atau lebih pemesanan terkonfirmasi saling bertabrakan pada rentang tanggal yang
            sama. Periksa tanggal bertanda merah pada kalender di bawah:
          </p>
          <ul className="list-disc list-inside text-xs space-y-1 text-red-900 dark:text-red-200 pl-1">
            {collisionReport.collisions.slice(0, 4).map((c, i) => (
              <li key={i}>
                <strong>{c.unitName || "Unit"}:</strong> {c.message} (Overlap: {c.overlapStart} s/d{" "}
                {c.overlapEnd})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Kartu Metrik Okupansi Bulan Ini */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs">
          <span className="text-xs text-muted-foreground block">Okupansi Portofolio</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-foreground">
              {stats.portfolioOccupancyRate}%
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs">
          <span className="text-xs text-muted-foreground block">Room Nights Terjual</span>
          <span className="text-2xl font-bold text-foreground mt-1 block">
            {stats.totalSoldNights}{" "}
            <span className="text-xs font-normal text-muted-foreground">malam</span>
          </span>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs">
          <span className="text-xs text-muted-foreground block">Room Nights Tersedia</span>
          <span className="text-2xl font-bold text-foreground mt-1 block">
            {stats.totalAvailableNights}{" "}
            <span className="text-xs font-normal text-muted-foreground">malam</span>
          </span>
        </div>

        <div
          className={`rounded-xl border p-3.5 shadow-2xs ${
            collisionReport.hasCollisions
              ? "border-red-300 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20"
              : "border-emerald-300 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
          }`}
        >
          <span
            className={`text-xs font-medium block ${
              collisionReport.hasCollisions
                ? "text-red-700 dark:text-red-300"
                : "text-emerald-700 dark:text-emerald-300"
            }`}
          >
            Integritas Jadwal
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            {collisionReport.hasCollisions ? (
              <>
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <span className="text-lg font-bold text-red-900 dark:text-red-200">
                  {collisionReport.collisions.length} Bentrok
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                  Aman (0 Bentrok)
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Grid Kalender Timeline */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base font-bold text-foreground">
            Garis Waktu Ketersediaan &amp; Okupansi
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Klik sel atau blok reservasi untuk melihat rincian pemesanan, tamu, atau peringatan
            bentrok.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[900px] border-collapse text-xs select-none">
              {/* Header Kolom Tanggal */}
              <div className="flex border-b border-border sticky top-0 bg-background/95 backdrop-blur-xs z-20">
                <div className="w-56 shrink-0 p-3 font-semibold text-foreground border-r border-border bg-muted/40">
                  Unit Kamar / Villa
                </div>
                <div className="flex flex-1">
                  {daysInMonth.map((day) => (
                    <div
                      key={day.date}
                      className={`flex-1 text-center py-2 border-r border-border/60 ${
                        day.isToday
                          ? "bg-primary/10 text-primary font-bold"
                          : day.isWeekend
                            ? "bg-muted/30 text-muted-foreground"
                            : "text-foreground"
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-tighter opacity-75">
                        {day.dayName}
                      </div>
                      <div className="text-xs font-semibold">{day.dayNumber}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Baris Unit per Properti */}
              {properties.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Tidak ada unit yang ditemukan untuk properti yang dipilih.
                </div>
              ) : (
                properties.map((prop) => (
                  <div key={prop.propertyId} className="border-b border-border">
                    {/* Header Nama Properti */}
                    <div className="bg-muted/60 px-3 py-1.5 font-bold text-xs text-foreground flex items-center gap-1.5 border-b border-border/50">
                      <Bed className="h-3.5 w-3.5 text-primary" />
                      <span>{prop.propertyName}</span>
                    </div>

                    {/* Baris Tiap Unit */}
                    {prop.units.map((unit) => (
                      <div
                        key={unit.unitId}
                        className="flex border-b border-border/40 hover:bg-muted/10 transition-colors"
                      >
                        {/* Kolom Info Unit */}
                        <div className="w-56 shrink-0 p-3 border-r border-border bg-card flex flex-col justify-center">
                          <div className="font-semibold text-xs text-foreground truncate">
                            {unit.unitName}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                            <span className="capitalize">{unit.kind.toLowerCase()}</span>
                            <span className="font-medium text-foreground">
                              {unit.occupancyRate}% okp
                            </span>
                          </div>
                        </div>

                        {/* Kolom Hari-hari */}
                        <div className="flex flex-1">
                          {unit.days.map((cell) => {
                            const b = cell.booking;
                            const block = cell.block;
                            const col = cell.collision;

                            const isCollision = !!col;
                            const isBooking = !!b;
                            const isBlock = !!block;
                            const isUnsellable = !cell.isSellable;

                            // Tentukan warna balok booking
                            let cellStyle = "bg-transparent hover:bg-muted/30";
                            let cellTitle = `${unit.unitName} - ${cell.date}`;

                            if (isCollision) {
                              cellStyle =
                                "bg-red-500 text-white font-bold animate-pulse hover:bg-red-600 cursor-pointer";
                              cellTitle = `BENTROK: ${col.message}`;
                            } else if (isBooking) {
                              const fallbackColor = {
                                bg: "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700",
                                text: "text-white",
                                border: "border-emerald-400",
                              };
                              const color = CHANNEL_COLORS[b.channel] ?? fallbackColor;
                              cellStyle = `${color.bg} ${color.text} cursor-pointer shadow-2xs`;
                              cellTitle = `Booking #${b.externalId} (${b.guestName || b.channel})`;
                            } else if (isBlock) {
                              cellStyle =
                                "bg-slate-400/80 dark:bg-slate-600/80 text-white cursor-pointer";
                              cellTitle = `iCal Block (${block.summary || "Reserved"})`;
                            } else if (isUnsellable) {
                              cellStyle =
                                "bg-neutral-200/60 dark:bg-neutral-800/60 text-muted-foreground opacity-60";
                              cellTitle = "Kamar tidak dijual";
                            }

                            return (
                              <button
                                type="button"
                                key={cell.date}
                                onClick={() => handleCellClick(cell, unit.unitName)}
                                title={cellTitle}
                                className={`flex-1 min-h-[46px] border-r border-border/40 p-0.5 flex flex-col items-center justify-center transition-all ${
                                  cell.isToday ? "ring-1 ring-inset ring-primary/40" : ""
                                }`}
                              >
                                <div
                                  className={`w-full h-full rounded-sm flex items-center justify-center text-[10px] overflow-hidden ${cellStyle}`}
                                >
                                  {isCollision ? (
                                    <AlertTriangle className="h-3.5 w-3.5 text-white shrink-0" />
                                  ) : isBooking ? (
                                    b.isFirstNight ? (
                                      <span className="truncate px-1 font-semibold text-[9px]">
                                        {b.guestName ? b.guestName.split(" ")[0] : b.channel}
                                      </span>
                                    ) : b.isMultiUnit ? (
                                      <Layers className="h-3 w-3 opacity-60 shrink-0" />
                                    ) : null
                                  ) : isBlock ? (
                                    <span className="text-[9px] opacity-75">iCal</span>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legenda Warna Kalender */}
      <div className="rounded-xl border border-border/80 bg-muted/20 p-4 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Keterangan / Legenda Saluran Kalender:</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-5 rounded bg-rose-500 inline-block" />
            <span className="text-foreground">Airbnb</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-5 rounded bg-blue-600 inline-block" />
            <span className="text-foreground">Tiket.com</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-5 rounded bg-cyan-600 inline-block" />
            <span className="text-foreground">Traveloka</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-5 rounded bg-emerald-600 inline-block" />
            <span className="text-foreground">Manual / Direct</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-5 rounded bg-slate-500 inline-block" />
            <span className="text-foreground">Blokir Tanggal iCal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-5 rounded bg-red-500 inline-block ring-1 ring-red-400" />
            <span className="font-semibold text-red-600 dark:text-red-400">
              Bentrok Jadwal (Double Booking)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3.5 w-5 rounded bg-neutral-300 dark:bg-neutral-800 inline-block" />
            <span className="text-muted-foreground">Kamar Tidak Dijual</span>
          </div>
        </div>
      </div>

      {/* Modal Detail Booking / Collision */}
      <BookingModal
        cell={selectedCell}
        unitName={selectedUnitName}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </div>
  );
}
