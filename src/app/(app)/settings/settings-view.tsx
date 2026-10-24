"use client";

/**
 * Komponen Tampilan Pengaturan Listing & Feed iCal (S9-02).
 */
import * as React from "react";
import Link from "next/link";
import {
  CalendarSync,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Layers,
  Calendar,
  Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { syncListingIcalNowAction, type SettingsActionResult } from "@/server/actions/settings";
import type { ListingDetailItem } from "@/server/queries/listings";
import { IcalDialog } from "./ical-dialog";

const CHANNEL_BADGE: Record<string, { label: string; className: string }> = {
  AIRBNB: {
    label: "Airbnb",
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300",
  },
  TIKET_COM: {
    label: "Tiket.com",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300",
  },
  TRAVELOKA: {
    label: "Traveloka",
    className:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/20 dark:text-cyan-300",
  },
  MANUAL: {
    label: "Manual",
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/20 dark:text-slate-300",
  },
};

interface SettingsViewProps {
  listings: ListingDetailItem[];
}

export function SettingsView({ listings: initialListings }: SettingsViewProps) {
  const [listings] = React.useState<ListingDetailItem[]>(initialListings);
  const [selectedListing, setSelectedListing] = React.useState<ListingDetailItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [syncingId, setSyncingId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<SettingsActionResult | null>(null);

  const handleOpenDialog = (listing: ListingDetailItem) => {
    setSelectedListing(listing);
    setIsDialogOpen(true);
  };

  const handleSyncNow = async (listingId: string) => {
    setSyncingId(listingId);
    setFeedback(null);
    try {
      const res = await syncListingIcalNowAction(listingId);
      setFeedback(res);
    } catch (err) {
      setFeedback({
        success: false,
        message: `Terjadi kesalahan: ${(err as Error).message}`,
      });
    } finally {
      setSyncingId(null);
    }
  };

  const formatLastFetched = (date: Date | null) => {
    if (!date) return "Belum pernah";
    const d = new Date(date);
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Makassar",
    });
  };

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`flex items-start justify-between gap-3 p-4 rounded-xl border text-sm ${
            feedback.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{feedback.success ? "Sukses" : "Peringatan"}</p>
              <p className="mt-0.5 text-xs opacity-90">{feedback.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Tabel Listing & Feed iCal */}
      <Card className="shadow-xs">
        <CardHeader className="pb-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Daftar Listing &amp; Integrasi Saluran
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Daftar kamar/estate yang terdaftar di masing-masing OTA, pemetaan unit fisik villa,
                dan sinkronisasi kalender iCal.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Layers className="h-3 w-3 text-primary" />
              <span>{listings.length} Listing Aktif</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-32">Saluran OTA</TableHead>
                  <TableHead>Nama Listing</TableHead>
                  <TableHead>Properti</TableHead>
                  <TableHead>Unit Fisik Villa</TableHead>
                  <TableHead>Feed iCal &amp; Blok Kalender</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground text-sm"
                    >
                      Belum ada listing yang terdaftar.
                    </TableCell>
                  </TableRow>
                ) : (
                  listings.map((l) => {
                    const chBadge = CHANNEL_BADGE[l.channel] || {
                      label: l.channel,
                      className: "border-border bg-muted text-foreground",
                    };
                    const isSyncing = syncingId === l.id;
                    const hasFeed = !!l.icalFeed;

                    return (
                      <TableRow key={l.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell>
                          <Badge variant="outline" className={`text-[11px] ${chBadge.className}`}>
                            {chBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-sm text-foreground">{l.name}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            ID: {l.externalId}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium text-foreground">
                            {l.propertyName}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {l.units.map((u) => (
                              <Badge
                                key={u.id}
                                variant="secondary"
                                className="text-[10px] bg-secondary/60 text-secondary-foreground"
                              >
                                {u.name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {hasFeed ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                                <span className="text-xs font-medium text-foreground">
                                  Terkoneksi
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] ml-1 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                                >
                                  {l.calendarBlocksCount} blok
                                </Badge>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                Sinkron: {formatLastFetched(l.icalFeed?.lastFetchedAt ?? null)}
                              </div>
                              {l.icalFeed?.lastStatus?.startsWith("FAILED") && (
                                <div className="text-[10px] text-red-600 dark:text-red-400 truncate max-w-xs">
                                  {l.icalFeed.lastStatus}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
                              <span>Belum diatur</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasFeed && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isSyncing}
                                onClick={() => handleSyncNow(l.id)}
                                className="h-8 px-2.5 text-xs gap-1 shadow-2xs"
                                title="Tarik feed iCal sekarang"
                              >
                                <RefreshCw
                                  className={`h-3 w-3 ${isSyncing ? "animate-spin text-primary" : ""}`}
                                />
                                <span className="hidden sm:inline">Sinkron</span>
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant={hasFeed ? "ghost" : "outline"}
                              size="sm"
                              onClick={() => handleOpenDialog(l)}
                              className="h-8 px-2.5 text-xs gap-1"
                            >
                              <Calendar className="h-3 w-3" />
                              <span>{hasFeed ? "Ubah" : "Atur iCal"}</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Informasi Arsitektur iCal & Komisi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-2xs border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarSync className="h-4 w-4 text-primary" />
              <span>Aturan Kalender iCal (ADR-012)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Feed iCal hanya digunakan untuk memperbarui status blokir ketersediaan tanggal (
              <strong>CalendarBlock</strong>) dan mendeteksi bentrok jadwal antar unit fisik.
            </p>
            <p>
              Data finansial, harga, dan komisi tidak ada di iCal dan dicatat melalui email
              konfirmasi reservasi atau ekspor CSV extranet.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              <span>Aturan Komisi OTA</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Rate komisi kontrak per saluran OTA dan skema pembayaran (Channel Collect vs Hotel
              Collect) dikelola secara terpusat untuk akurasi laporan keuangan.
            </p>
            <div className="pt-1">
              <Button asChild variant="outline" size="sm" className="text-xs h-7 gap-1">
                <Link href="/cash">
                  <span>Kelola di Tab Kas</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Dialog iCal */}
      <IcalDialog
        listing={selectedListing}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={(res) => setFeedback(res)}
      />
    </div>
  );
}
