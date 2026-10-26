"use client";

/**
 * Dialog Form Pembuatan Template Biaya Rutin (S3-03).
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
import { createRecurringTemplateAction, type ExpenseActionResult } from "@/server/actions/expenses";
import type { ExpenseCategoryDto, PropertyOptionDto } from "@/server/queries/expenses";

interface RecurringTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategoryDto[];
  properties: PropertyOptionDto[];
  onSuccess?: () => void;
}

export function RecurringTemplateDialog({
  open,
  onOpenChange,
  categories,
  properties,
  onSuccess,
}: RecurringTemplateDialogProps) {
  const [isPending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<ExpenseActionResult | null>(null);

  const [frequency, setFrequency] = React.useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [nextRunOn, setNextRunOn] = React.useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id || "");
  const [propertyId, setPropertyId] = React.useState("SHARED");
  const [amount, setAmount] = React.useState("");
  const [vendor, setVendor] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [paymentMethod] = React.useState("TRANSFER");

  const resetForm = () => {
    setResult(null);
    setAmount("");
    setVendor("");
    setDescription("");
    setNextRunOn(new Date().toISOString().slice(0, 10));
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

    const catObj = categories.find((c) => c.id === categoryId);
    const propObj = properties.find((p) => p.id === propertyId);

    startTransition(async () => {
      const res = await createRecurringTemplateAction({
        frequency,
        nextRunOn,
        categoryId,
        categoryName: catObj?.name || "Operasional",
        propertyId: propertyId === "SHARED" ? null : propertyId,
        propertyName:
          propertyId === "SHARED" ? "Biaya Bersama (Shared)" : propObj?.name || "Properti",
        amount,
        vendor,
        description,
        paymentMethod,
      });

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
          <DialogTitle className="text-base font-bold">Tambah Template Biaya Rutin</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Biaya berulang bulanan/tahunan (seperti tagihan internet, gaji, atau pemeliharaan) yang
            otomatis dibuat menjadi entri draf pada tanggal jatuh tempo.
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Frekuensi Berulang
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as "MONTHLY" | "ANNUAL")}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="MONTHLY">Bulanan (Monthly)</option>
                <option value="ANNUAL">Tahunan (Annual)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Jatuh Tempo Pertama
              </label>
              <input
                type="date"
                required
                value={nextRunOn}
                onChange={(e) => setNextRunOn(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Nominal Rutin (IDR) <span className="text-rose-500">*</span>
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
                placeholder="Contoh: 750000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Kategori Beban
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Properti
              </label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                <option value="SHARED">Biaya Bersama</option>
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
              Vendor / Penyedia
            </label>
            <input
              type="text"
              placeholder="Contoh: Biznet, Indihome, BPJS Ketenagakerjaan..."
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Keterangan Template
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Tagihan internet wifi villa utama setiap tanggal 1..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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
              className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
            >
              {isPending ? "Menyimpan..." : "Simpan Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
