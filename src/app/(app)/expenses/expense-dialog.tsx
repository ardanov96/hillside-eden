"use client";

/**
 * Dialog Form Input Pengeluaran Baru (S3-01 & S3-02).
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
import { UploadCloud, CheckCircle2, AlertCircle, FileText, X } from "lucide-react";
import { createExpenseAction, type ExpenseActionResult } from "@/server/actions/expenses";
import type { ExpenseCategoryDto, PropertyOptionDto } from "@/server/queries/expenses";

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategoryDto[];
  properties: PropertyOptionDto[];
  defaultPropertyId?: string;
  onSuccess?: () => void;
}

export function ExpenseDialog({
  open,
  onOpenChange,
  categories,
  properties,
  defaultPropertyId,
  onSuccess,
}: ExpenseDialogProps) {
  const [isPending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<ExpenseActionResult | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form state
  const todayStr = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = React.useState("");
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id || "");
  const [propertyId, setPropertyId] = React.useState(defaultPropertyId || "SHARED");
  const [incurredOn, setIncurredOn] = React.useState(todayStr);
  const [paidOn, setPaidOn] = React.useState(todayStr);
  const [vendor, setVendor] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("TRANSFER");
  const [status, setStatus] = React.useState<"DRAFT" | "VERIFIED">("VERIFIED");

  const resetForm = () => {
    setResult(null);
    setSelectedFile(null);
    setAmount("");
    setIncurredOn(new Date().toISOString().slice(0, 10));
    setPaidOn(new Date().toISOString().slice(0, 10));
    setVendor("");
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
    formData.append("categoryId", categoryId);
    formData.append("propertyId", propertyId);
    formData.append("incurredOn", incurredOn);
    formData.append("paidOn", paidOn);
    formData.append("vendor", vendor);
    formData.append("description", description);
    formData.append("paymentMethod", paymentMethod);
    formData.append("status", status);

    if (selectedFile) {
      formData.append("receiptFile", selectedFile);
    }

    startTransition(async () => {
      const res = await createExpenseAction(null, formData);
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Catat Pengeluaran Baru</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Catat beban operasional villa, gaji staf, perlengkapan, atau biaya bersama properti.
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
          {/* Baris 1: Nominal & Tanggal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Nominal (IDR) <span className="text-rose-500">*</span>
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
                  placeholder="Contoh: 1500000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Tanggal Pengeluaran <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={incurredOn}
                onChange={(e) => {
                  setIncurredOn(e.target.value);
                  setPaidOn(e.target.value);
                }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
              />
            </div>
          </div>

          {/* Baris 2: Kategori & Properti */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Kategori Beban <span className="text-rose-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
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
                Beban Properti <span className="text-rose-500">*</span>
              </label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
              >
                <option value="SHARED">Biaya Bersama (Shared / Alokasi Rata)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Baris 3: Vendor & Metode Bayar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Vendor / Penerima (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: PLN, Toko Bangunan, Staf Laundry"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
              >
                <option value="TRANSFER">Transfer Bank</option>
                <option value="CASH">Tunai (Cash)</option>
                <option value="CREDIT_CARD">Kartu Kredit / Debit</option>
                <option value="E_WALLET">E-Wallet (GoPay/OVO/QRIS)</option>
              </select>
            </div>
          </div>

          {/* Keterangan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Keterangan / Rincian
            </label>
            <textarea
              rows={2}
              placeholder="Deskripsi pengeluaran, nomor nota, atau rincian item..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white"
            />
          </div>

          {/* Upload Bukti Struk / Nota (S3-02) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Foto Struk / Nota (Opsional, Maks 10 MB)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setSelectedFile(f);
              }}
            />

            {selectedFile ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/50">
                <div className="flex items-center gap-2 overflow-hidden text-xs">
                  <FileText className="h-4 w-4 shrink-0 text-slate-600 dark:text-zinc-400" />
                  <span className="truncate font-medium text-slate-800 dark:text-zinc-200">
                    {selectedFile.name}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    ({(selectedFile.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-slate-500 hover:text-slate-800"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 py-3 text-xs text-slate-600 hover:bg-slate-100/70 hover:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800/30 dark:text-zinc-400 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <UploadCloud className="h-4 w-4" />
                <span>Pilih atau seret berkas nota/struk (JPEG, PNG, PDF)</span>
              </button>
            )}
          </div>

          {/* Status Simpan */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 bg-slate-50/60 dark:border-zinc-800 dark:bg-zinc-800/40">
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                Status Pencatatan
              </p>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Data terverifikasi langsung masuk laporan; data draf dapat diedit/dihapus sebelum
                diverifikasi.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStatus("DRAFT")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  status === "DRAFT"
                    ? "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                    : "text-slate-600 hover:bg-slate-200 dark:text-zinc-400"
                }`}
              >
                Draf
              </button>
              <button
                type="button"
                onClick={() => setStatus("VERIFIED")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  status === "VERIFIED"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                    : "text-slate-600 hover:bg-slate-200 dark:text-zinc-400"
                }`}
              >
                Terverifikasi
              </button>
            </div>
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
              {isPending ? "Menyimpan..." : "Simpan Pengeluaran"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
