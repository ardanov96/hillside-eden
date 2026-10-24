"use client";

/**
 * Modal Dialog untuk Memetakan Listing pada Item Karantina (S9-03).
 */
import * as React from "react";
import { GitMerge, RefreshCw, AlertCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  resolveAndReprocessItemAction,
  type AttentionActionResult,
} from "@/server/actions/attention";
import type { AttentionItemSummary } from "@/server/queries/attention";
import type { ListingOption } from "@/server/queries/listings";

interface ResolveDialogProps {
  item: AttentionItemSummary | null;
  listingOptions: ListingOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result: AttentionActionResult) => void;
}

export function ResolveDialog({
  item,
  listingOptions,
  open,
  onOpenChange,
  onSuccess,
}: ResolveDialogProps) {
  const [selectedListingId, setSelectedListingId] = React.useState<string>("");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  if (!item) return null;

  const b = item.bookingDetails;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListingId) {
      setError("Silakan pilih listing tujuan.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await resolveAndReprocessItemAction({
        itemId: item.id,
        targetListingId: selectedListingId,
      });
      if (res.success) {
        onSuccess(res);
        onOpenChange(false);
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <GitMerge className="h-5 w-5 text-primary" />
            <span>Petakan Listing &amp; Proses Ulang</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Tautkan reservasi ini ke listing fisik di sistem agar dapat diproses ke daftar booking
            dan laporan keuangan.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Informasi Ringkas Reservasi */}
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Kode Reservasi:</span>
            <span className="font-mono font-semibold text-foreground">{b?.externalId || "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Saluran:</span>
            <span className="font-medium text-foreground">{b?.channel || item.channel || "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Nama Tamu:</span>
            <span className="font-medium text-foreground">{b?.guestName || "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Periode Menginap:</span>
            <span className="font-medium text-foreground">
              {b?.checkIn && b?.checkOut ? `${b.checkIn} s/d ${b.checkOut}` : "-"}
            </span>
          </div>
          {b?.listingName && (
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span className="text-muted-foreground">Nama di OTA:</span>
              <span className="font-medium text-amber-700 dark:text-amber-300">
                &quot;{b.listingName}&quot;
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Pilih Listing Tujuan di Sistem:
            </label>
            <Select value={selectedListingId} onValueChange={setSelectedListingId}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="-- Pilih Listing --" />
              </SelectTrigger>
              <SelectContent>
                {listingOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id} className="text-xs">
                    {opt.label} ({opt.channel})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!selectedListingId || isPending}
              className="gap-1.5 shadow-xs"
            >
              {isPending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Memproses Ulang...</span>
                </>
              ) : (
                <span>Simpan &amp; Proses Ulang</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
