"use client";

/**
 * Modal Dialog untuk Inspeksi Raw Payload Item Karantina (S9-03).
 */
import * as React from "react";
import { Code, Copy, Check } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AttentionItemSummary } from "@/server/queries/attention";

interface PayloadDialogProps {
  item: AttentionItemSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PayloadDialog({ item, open, onOpenChange }: PayloadDialogProps) {
  const [copied, setCopied] = React.useState(false);

  if (!item) return null;

  const jsonStr = JSON.stringify(item.rawPayload ?? {}, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Code className="h-5 w-5 text-primary" />
              <span>Data Mentah (Raw Payload)</span>
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-7 text-xs gap-1"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Salin JSON</span>
                </>
              )}
            </Button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Data JSON yang diekstrak oleh parser adapter sebelum terjadi kesalahan atau kebutuhan
            peninjauan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto rounded-lg border border-border/80 bg-muted/40 p-3 font-mono text-[11px] text-foreground">
          <pre className="whitespace-pre-wrap break-all">{jsonStr}</pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
