"use client";

/**
 * Komponen Tampilan Halaman "Perlu Perhatian" / Karantina (S9-03 / S2-03).
 */
import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Mail,
  GitMerge,
  Eye,
  Trash2,
  Inbox,
  Filter,
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
import { dismissAttentionItemAction, type AttentionActionResult } from "@/server/actions/attention";
import type { AttentionItemSummary } from "@/server/queries/attention";
import type { ListingOption } from "@/server/queries/listings";
import { ResolveDialog } from "./resolve-dialog";
import { PayloadDialog } from "./payload-dialog";

interface AttentionViewProps {
  initialItems: AttentionItemSummary[];
  counts: { needsReview: number; failed: number; total: number };
  listingOptions: ListingOption[];
}

export function AttentionView({ initialItems, counts, listingOptions }: AttentionViewProps) {
  const [items, setItems] = React.useState<AttentionItemSummary[]>(initialItems);
  const [filterStatus, setFilterStatus] = React.useState<"ALL" | "NEEDS_REVIEW" | "FAILED">("ALL");
  const [selectedResolveItem, setSelectedResolveItem] = React.useState<AttentionItemSummary | null>(
    null,
  );
  const [selectedPayloadItem, setSelectedPayloadItem] = React.useState<AttentionItemSummary | null>(
    null,
  );
  const [feedback, setFeedback] = React.useState<AttentionActionResult | null>(null);

  const filteredItems = items.filter((item) => {
    if (filterStatus === "ALL") return true;
    return item.status === filterStatus;
  });

  const handleDismiss = async (item: AttentionItemSummary) => {
    const reason = prompt(
      "Masukkan alasan pengabaian data ini:",
      "Bukan reservasi valid / duplikat manual",
    );
    if (reason === null) return; // User batalkan

    try {
      const res = await dismissAttentionItemAction({
        itemId: item.id,
        reason: reason.trim(),
      });
      if (res.success) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setFeedback(res);
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert(`Gagal: ${(err as Error).message}`);
    }
  };

  const handleResolveSuccess = (res: AttentionActionResult) => {
    if (selectedResolveItem) {
      setItems((prev) => prev.filter((i) => i.id !== selectedResolveItem.id));
    }
    setFeedback(res);
  };

  const formatDateTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Makassar",
    });
  };

  return (
    <div className="space-y-6">
      {/* Banner Feedback */}
      {feedback && (
        <div
          className={`flex items-start justify-between gap-3 p-4 rounded-xl border text-sm ${
            feedback.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"
          }`}
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="font-semibold">{feedback.message}</p>
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

      {/* Kartu Metrik Ringkas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Karantina</span>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground mt-1.5">{items.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Perlu Perhatian (Listing Belum Dikenal)
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-amber-900 dark:text-amber-200 mt-1.5">
            {counts.needsReview}
          </p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-800 dark:text-red-300">
              Gagal Parse / Format Rusak
            </span>
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-red-900 dark:text-red-200 mt-1.5">
            {counts.failed}
          </p>
        </div>
      </div>

      {/* Tabel Karantina */}
      <Card className="shadow-xs">
        <CardHeader className="pb-4 border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Kotak Masuk Data Karantina
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                Item impor dari email atau CSV yang membutuhkan peninjauan, pemetaan manual ke unit
                villa, atau tindakan koreksi.
              </CardDescription>
            </div>

            {/* Filter Pill */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border/70 p-1 bg-muted/30 text-xs">
              <Filter className="h-3 w-3 text-muted-foreground ml-1 mr-0.5" />
              <button
                type="button"
                onClick={() => setFilterStatus("ALL")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterStatus === "ALL"
                    ? "bg-background text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Semua ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("NEEDS_REVIEW")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterStatus === "NEEDS_REVIEW"
                    ? "bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Perlu Perhatian
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("FAILED")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterStatus === "FAILED"
                    ? "bg-red-100 dark:bg-red-900/50 text-red-900 dark:text-red-200 font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Gagal
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead>Sumber &amp; Waktu</TableHead>
                  <TableHead>Rincian Reservasi</TableHead>
                  <TableHead>Keterangan Masalah</TableHead>
                  <TableHead className="text-right">Tindakan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 p-3 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          Tidak ada data yang memerlukan perhatian
                        </p>
                        <p className="text-xs text-muted-foreground max-w-sm text-center">
                          Seluruh data reservasi dari CSV dan email telah berhasil dipetakan ke unit
                          dan tersinkronisasi bersih ke sistem.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const isNeedsReview = item.status === "NEEDS_REVIEW";
                    const b = item.bookingDetails;

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell>
                          {isNeedsReview ? (
                            <Badge
                              variant="outline"
                              className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 text-[11px]"
                            >
                              Perlu Perhatian
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 text-[11px]"
                            >
                              Gagal Parse
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                            {item.sourceKind === "EMAIL" ? (
                              <Mail className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            )}
                            <span className="truncate max-w-[180px]">
                              {item.filename || item.sourceKind}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {formatDateTime(item.receivedAt)}
                          </div>
                        </TableCell>

                        <TableCell>
                          {b ? (
                            <div className="space-y-0.5 text-xs">
                              <div className="font-mono font-semibold text-foreground">
                                {b.externalId || "-"}
                                {b.channel && (
                                  <span className="font-sans text-[10px] text-muted-foreground ml-1.5">
                                    ({b.channel})
                                  </span>
                                )}
                              </div>
                              <div className="text-muted-foreground text-[11px]">
                                {b.guestName || "Tamu tidak bernama"} ·{" "}
                                {b.checkIn && b.checkOut ? `${b.checkIn} - ${b.checkOut}` : "-"}
                              </div>
                              {b.listingName && (
                                <div className="text-[10px] text-amber-700 dark:text-amber-300 truncate max-w-xs">
                                  Listing: &quot;{b.listingName}&quot;
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Payload belum ter-parse
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="space-y-0.5 max-w-xs sm:max-w-sm">
                            {item.errorCode && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-mono px-1.5 py-0"
                              >
                                {item.errorCode}
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {item.errorMessage || "Tidak ada rincian pesan kesalahan."}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isNeedsReview && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => setSelectedResolveItem(item)}
                                className="h-8 px-2.5 text-xs gap-1 shadow-2xs"
                              >
                                <GitMerge className="h-3 w-3" />
                                <span>Petakan</span>
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPayloadItem(item)}
                              className="h-8 px-2.5 text-xs gap-1"
                              title="Lihat Raw Payload"
                            >
                              <Eye className="h-3 w-3" />
                              <span className="hidden sm:inline">Payload</span>
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDismiss(item)}
                              className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                              title="Abaikan item ini"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Abaikan</span>
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

      {/* Modal Dialogs */}
      <ResolveDialog
        item={selectedResolveItem}
        listingOptions={listingOptions}
        open={!!selectedResolveItem}
        onOpenChange={(open) => !open && setSelectedResolveItem(null)}
        onSuccess={handleResolveSuccess}
      />

      <PayloadDialog
        item={selectedPayloadItem}
        open={!!selectedPayloadItem}
        onOpenChange={(open) => !open && setSelectedPayloadItem(null)}
      />
    </div>
  );
}
