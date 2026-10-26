"use client";

/**
 * Dialog Form Input Pendapatan Lain Non-OTA (S3-06).
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
import { CheckCircle2, AlertCircle } from "lucide-react";
import { createOtherIncomeAction, type ExpenseActionResult } from "@/server/actions/expenses";
import type { PropertyOptionDto } from "@/server/queries/expenses";

interface OtherIncomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: PropertyOptionDto[];
  onSuccess?: () => void;
}

const INCOME_CATEGORIES = [
  { value: "DIRECT_BOOKING", label: "Tamu Langsung (Direct Booking)" },
  { value: "FNB", label: "Makanan & Minuman (F&B / Resto)" },
  { value: "SPA", label: "Layanan Spa & Pijat" },
  { value: "TRANSFER", label: "Antar-Jemput / Transportasi" },
  { value: "OTHER", label: "Layanan Tambahan Lainnya" },
] as const;

export function OtherIncomeDialog({
  open,
  onOpenChange,
  properties,
  onSuccess,
}: OtherIncomeDialogProps) {
  const [isPending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<ExpenseActionResult | null>(null);

  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState<string>("FNB");
  const [propertyId, setPropertyId] = React.useState<string>(properties[0]?.id || "");
  const [receivedOn, setReceivedOn] = React.useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = React.useState("");

  const resetForm = () => {
    setResult(null);
    setAmount("");
    setReceivedOn(new Date().toISOString().slice(0, 10));
    setDescription("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    const formData = new FormData();
    formData.append("amount", amount);
    formData.append("category", category);
    formData.append("propertyId", propertyId);
    formData.append("receivedOn", receivedOn);
    formData.append("description", description);

    startTransition(async () => {
      const res = await createOtherIncomeAction(null, formData);
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
          <DialogTitle className="text-lg font-bold">Catat Pendapatan Lain</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Catat pemasukan non-OTA seperti penjualan makanan/minuman, spa, antar-jemput, atau tamu
            langsung.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Nominal Masuk (IDR) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-semibold text-slate-400">
                Rp
              </span>
              <input
                type="number"
                min="1"
                step="1"
                required
                placeholder="Contoh: 500000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Kategori Pendapatan <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
              >
                {INCOME_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Properti Terkait
              </label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Tanggal Penerimaan <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={receivedOn}
              onChange={(e) => setReceivedOn(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Deskripsi / Keterangan
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Makan malam BBQ tamu Villa A, Paket Spa 2 Orang..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
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
              disabled={isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isPending ? "Menyimpan..." : "Simpan Pendapatan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
