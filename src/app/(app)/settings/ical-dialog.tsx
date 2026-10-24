"use client";

/**
 * Modal Dialog Pengaturan Feed iCal (S9-02).
 */
import * as React from "react";
import { CalendarSync, Trash2, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveListingIcalAction,
  deleteListingIcalAction,
  type SettingsActionResult,
} from "@/server/actions/settings";
import type { ListingDetailItem } from "@/server/queries/listings";

interface IcalDialogProps {
  listing: ListingDetailItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result: SettingsActionResult) => void;
}

interface IcalFormProps {
  listing: ListingDetailItem;
  onClose: () => void;
  onSuccess: (result: SettingsActionResult) => void;
}

function IcalForm({ listing, onClose, onSuccess }: IcalFormProps) {
  const [url, setUrl] = React.useState(listing.icalFeed?.rawUrl || "");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError("Silakan masukkan URL feed iCal.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await saveListingIcalAction({
        listingId: listing.id,
        icalUrl: url.trim(),
      });
      if (res.success) {
        onSuccess(res);
        onClose();
      } else {
        setError(res.message);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Apakah Anda yakin ingin menghapus konfigurasi feed iCal ini?")) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await deleteListingIcalAction(listing.id);
      if (res.success) {
        onSuccess(res);
        onClose();
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 pt-2">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="ical-url" className="text-xs font-semibold text-foreground">
          URL Feed iCal (.ics)
        </label>
        <Input
          id="ical-url"
          type="url"
          placeholder="https://www.airbnb.com/calendar/ical/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="text-xs font-mono"
          required
        />
        {listing.icalFeed?.maskedUrl && (
          <p className="text-[11px] text-muted-foreground truncate">
            Tersimpan: <span className="font-mono">{listing.icalFeed.maskedUrl}</span>
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1.5">
        <div className="flex items-center gap-1 font-medium text-foreground">
          <ExternalLink className="h-3 w-3 text-primary" />
          <span>Petunjuk Mendapatkan URL iCal:</span>
        </div>
        <p>
          <strong>Airbnb:</strong> Buka <em>Listing</em> &gt; pilih listing &gt; tab{" "}
          <em>Pricing and availability</em> &gt; bagian <em>Calendar sync</em> &gt; klik{" "}
          <em>Export Calendar</em>.
        </p>
        <p>
          URL ini dienkripsi dengan standar <strong>AES-256-GCM</strong> di database sebelum
          disimpan.
        </p>
      </div>

      <DialogFooter className="flex flex-row items-center justify-between gap-2 sm:justify-between pt-2">
        {listing.icalFeed ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            className="text-destructive hover:bg-destructive/10 text-xs gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Hapus Feed</span>
          </Button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Batal
          </Button>
          <Button type="submit" size="sm" disabled={isPending} className="gap-1.5 shadow-xs">
            {isPending ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Menyinkronkan...</span>
              </>
            ) : (
              <span>Simpan &amp; Sinkronkan</span>
            )}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

export function IcalDialog({ listing, open, onOpenChange, onSuccess }: IcalDialogProps) {
  if (!listing) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <CalendarSync className="h-5 w-5 text-primary" />
            <span>Kelola Feed iCal: {listing.name}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Masukkan URL ekspor iCalendar (.ics) dari OTA untuk menyinkronkan blok ketersediaan dan
            mencegah bentrok jadwal secara otomatis.
          </DialogDescription>
        </DialogHeader>

        <IcalForm
          key={`${listing.id}-${open}`}
          listing={listing}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
