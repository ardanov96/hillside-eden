"use client";

/**
 * Dialog Konfirmasi Entri Pembalik Koreksi (ADR-008 & S3-07).
 */
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { reverseExpenseAction, type ExpenseActionResult } from "@/server/actions/expenses";
import type { ExpenseItemDto } from "@/server/queries/expenses";
import { formatIDR } from "@/lib/format-id";

interface ReversalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: ExpenseItemDto | null;
  onSuccess?: () => void;
}

export function ReversalDialog({ open, onOpenChange, expense, onSuccess }: ReversalDialogProps) {
  const [isPending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<ExpenseActionResult | null>(null);
  const [reason, setReason] = React.useState("");

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setResult(null);
      setReason("");
    }
    onOpenChange(newOpen);
  };

  if (!expense) return null;

  const handleReverse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setResult(null);
    startTransition(async () => {
      const res = await reverseExpenseAction(expense.id, reason.trim());
      setResult(res);
      if (res.success) {
        setTimeout(() => {
          onOpenChange(false);
          onSuccess?.();
        }, 1200);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle className="text-base font-bold">Koreksi Entri Pembalik</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 pt-1">
            Sesuai standar audit finansial (ADR-008), data yang telah terverifikasi tidak dihapus,
            melainkan dikoreksi dengan membuat baris pembalik bertanda minus (-).
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div
            className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
              result.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
            }`}
          >
            {result.success ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            )}
            <p className="flex-1 font-medium">{result.message}</p>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-800/40 space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Kategori:</span>
            <span className="font-semibold text-slate-800 dark:text-zinc-200">
              {expense.categoryName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Nominal Asal:</span>
            <span className="font-semibold text-rose-600">{formatIDR(Number(expense.amount))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Tanggal:</span>
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              {expense.incurredOn}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Properti:</span>
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              {expense.propertyName}
            </span>
          </div>
          {expense.description && (
            <div className="border-t border-slate-200 pt-1 text-[11px] text-slate-600 dark:border-zinc-700 dark:text-zinc-400">
              {expense.description}
            </div>
          )}
        </div>

        <form onSubmit={handleReverse} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Alasan Koreksi / Pembalikan <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              placeholder="Contoh: Salah input nominal, transaksi dibatalkan vendor, nota ganda..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
              disabled={isPending || !reason.trim()}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {isPending ? "Memproses..." : "Buat Entri Pembalik"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
