"use client";

/**
 * Modal Detail Reservasi / Bentrok Jadwal pada Kalender (S10-01).
 */
import * as React from "react";
import Link from "next/link";
import { Calendar, User, AlertTriangle, ExternalLink, Layers, Clock } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/format-id";
import type { CalendarDayCell } from "@/server/queries/calendar";

interface BookingModalProps {
  cell: CalendarDayCell | null;
  unitName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BookingModal({ cell, unitName, open, onOpenChange }: BookingModalProps) {
  if (!cell) return null;

  const b = cell.booking;
  const block = cell.block;
  const col = cell.collision;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {unitName}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">{cell.date}</span>
          </div>
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground mt-1">
            {col
              ? "Peringatan Bentrok Jadwal"
              : b
                ? `Reservasi: #${b.externalId}`
                : block
                  ? "Blokir Tanggal (iCal)"
                  : cell.isSellable
                    ? "Kamar Kosong (Tersedia)"
                    : "Kamar Tidak Dijual"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {col
              ? "Terdapat dua jadwal atau blok reservasi yang saling bertabrakan pada tanggal ini."
              : b
                ? `Detail pemesanan tamu dari saluran ${b.channel}.`
                : block
                  ? "Jadwal diblokir melalui sinkronisasi kalender iCal eksternal."
                  : cell.isSellable
                    ? "Unit kamar siap menerima reservasi."
                    : "Unit kamar ditutup penjualannya pada konfigurasi inventori."}
          </DialogDescription>
        </DialogHeader>

        {/* Banner Bentrok jika ada collision */}
        {col && (
          <div className="rounded-xl border border-red-300 bg-red-50/70 p-3.5 text-xs text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <span>BENTROK JADWAL TERDETEKSI</span>
            </div>
            <p className="text-[11px] leading-relaxed">{col.message}</p>
            <div className="text-[11px] pt-1 border-t border-red-200 dark:border-red-900/40">
              Bertabrakan dengan: <strong className="font-mono">{col.conflictWith}</strong>
            </div>
          </div>
        )}

        {/* Informasi Detail Booking */}
        {b && (
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 text-xs space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Saluran OTA:</span>
              <Badge variant="secondary" className="font-semibold text-xs">
                {b.channel}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-primary" />
                <span>Nama Tamu:</span>
              </span>
              <span className="font-semibold text-foreground">{b.guestName || "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Check-in / Check-out:</span>
              </span>
              <span className="font-mono text-foreground">
                {b.checkIn} → {b.checkOut} ({b.nights} malam)
              </span>
            </div>
            {b.grossAmount && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Nilai Booking (Gross):</span>
                <span className="font-semibold text-foreground">{formatIDR(b.grossAmount)}</span>
              </div>
            )}
            {b.isMultiUnit && (
              <div className="flex items-center gap-1.5 text-primary pt-1 font-medium">
                <Layers className="h-3.5 w-3.5" />
                <span>Pemesanan Paket Estate (Banyak Unit)</span>
              </div>
            )}
          </div>
        )}

        {/* Informasi Blokir iCal */}
        {block && (
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ringkasan iCal:</span>
              <span className="font-medium text-foreground">{block.summary || "Reserved"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>Rentang Blokir:</span>
              </span>
              <span className="font-mono text-foreground">
                {block.startDate} s/d {block.endDate}
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-row items-center justify-between gap-2 pt-2">
          {b ? (
            <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
              <Link href={`/bookings?search=${encodeURIComponent(b.externalId)}`}>
                <span>Buka di Daftar Booking</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          ) : (
            <div />
          )}

          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
