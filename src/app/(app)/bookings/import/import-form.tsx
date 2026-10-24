"use client";

/**
 * Komponen Form Impor CSV OTA (S9-01).
 *
 * Mendukung drag-and-drop berkas CSV, pemilihan saluran OTA (atau deteksi otomatis),
 * panduan ekspor extranet, dan feedback batch hasil ekspor yang kaya.
 */
import * as React from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  X,
  ArrowRight,
  Info,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { importOtaCsvAction, type ImportResultState } from "@/server/actions/import";

const CHANNELS = [
  { id: "AUTO", label: "Deteksi Otomatis", desc: "Airbnb, Tiket, atau Traveloka", isAuto: true },
  { id: "AIRBNB", label: "Airbnb", desc: "Reservasi & Payout CSV", isAuto: false },
  { id: "TIKET_COM", label: "Tiket.com", desc: "Ekspor Reservasi CSV", isAuto: false },
  { id: "TRAVELOKA", label: "Traveloka", desc: "Tera Extranet CSV", isAuto: false },
] as const;

export function ImportForm() {
  const [selectedChannel, setSelectedChannel] = React.useState<string>("AUTO");
  const [file, setFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [state, setState] = React.useState<ImportResultState | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      if (dropped.name.toLowerCase().endsWith(".csv")) {
        setFile(dropped);
        setState(null);
      } else {
        alert("Mohon pilih berkas dengan format .csv");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) {
      if (picked.name.toLowerCase().endsWith(".csv")) {
        setFile(picked);
        setState(null);
      } else {
        alert("Mohon pilih berkas dengan format .csv");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("channel", selectedChannel);

    startTransition(async () => {
      const res = await importOtaCsvAction(null, formData);
      setState(res);
    });
  };

  const handleReset = () => {
    setFile(null);
    setState(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Kartu Hasil Impor */}
      {state && (
        <Card
          className={`overflow-hidden border shadow-sm ${
            state.success
              ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20"
              : "border-red-200 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20"
          }`}
        >
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              {state.success ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 flex-1">
                <h3
                  className={`text-base font-semibold ${
                    state.success
                      ? "text-emerald-900 dark:text-emerald-200"
                      : "text-red-900 dark:text-red-200"
                  }`}
                >
                  {state.success ? "Sinkronisasi Berhasil" : "Impor Gagal"}
                </h3>
                <p
                  className={`text-sm ${
                    state.success
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {state.message}
                </p>
              </div>
            </div>

            {/* Statistik Batch */}
            {state.stats && state.stats.total > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                <div className="rounded-lg border border-border/60 bg-background/80 p-3 text-center">
                  <span className="block text-xs text-muted-foreground">Total Data</span>
                  <span className="text-lg font-bold text-foreground">{state.stats.total}</span>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-100/40 dark:border-emerald-900 dark:bg-emerald-950/30 p-3 text-center">
                  <span className="block text-xs text-emerald-700 dark:text-emerald-300">
                    Booking Baru
                  </span>
                  <span className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                    {state.stats.created}
                  </span>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-100/40 dark:border-blue-900 dark:bg-blue-950/30 p-3 text-center">
                  <span className="block text-xs text-blue-700 dark:text-blue-300">Diperbarui</span>
                  <span className="text-lg font-bold text-blue-800 dark:text-blue-200">
                    {state.stats.updated}
                  </span>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/80 p-3 text-center">
                  <span className="block text-xs text-muted-foreground">Duplikat Dilewati</span>
                  <span className="text-lg font-bold text-muted-foreground">
                    {state.stats.duplicate}
                  </span>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-100/40 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-center">
                  <span className="block text-xs text-amber-700 dark:text-amber-300">
                    Perlu Perhatian
                  </span>
                  <span className="text-lg font-bold text-amber-800 dark:text-amber-200">
                    {state.stats.needsReview}
                  </span>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-indigo-100/40 dark:border-indigo-900 dark:bg-indigo-950/30 p-3 text-center">
                  <span className="block text-xs text-indigo-700 dark:text-indigo-300">
                    Payout Tertaut
                  </span>
                  <span className="text-lg font-bold text-indigo-800 dark:text-indigo-200">
                    {state.stats.payoutsLinked}
                  </span>
                </div>
              </div>
            )}

            {/* Error Detail */}
            {state.errors && state.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Catatan Validasi:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  {state.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err.message}</li>
                  ))}
                  {state.errors.length > 5 && (
                    <li>...dan {state.errors.length - 5} catatan lainnya.</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleReset}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Unggah Berkas Lain
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <Link href="/bookings">
                  <span>Lihat di Daftar Booking</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulir Unggah Berkas */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pilihan Saluran OTA */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            1. Pilih Saluran OTA
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {CHANNELS.map((ch) => {
              const active = selectedChannel === ch.id;
              return (
                <button
                  type="button"
                  key={ch.id}
                  onClick={() => setSelectedChannel(ch.id)}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                    active
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/40 shadow-xs"
                      : "border-border/70 bg-card hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      {ch.isAuto && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                      {ch.label}
                    </span>
                    {active && <span className="h-2 w-2 rounded-full bg-primary inline-block" />}
                  </div>
                  <span className="text-[11px] mt-1 text-muted-foreground line-clamp-1">
                    {ch.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dropzone Unggah Berkas */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
            2. Unggah Berkas Ekspor CSV
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-file-input"
          />

          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center p-8 sm:p-12 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center ${
                isDragging
                  ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                  : "border-border/80 bg-muted/20 hover:bg-muted/40 hover:border-border"
              }`}
            >
              <div className="rounded-full bg-primary/10 p-3.5 text-primary mb-3">
                <UploadCloud className="h-7 w-7" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Tarik & jatuhkan berkas CSV di sini, atau{" "}
                <span className="text-primary underline underline-offset-2">
                  pilih dari komputer
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                Mendukung berkas CSV reservasi atau payout hingga 10 MB
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatFileSize(file.size)} · Berkas CSV siap disinkronkan
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-muted-foreground hover:text-destructive shrink-0"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Hapus berkas</span>
              </Button>
            </div>
          )}
        </div>

        {/* Petunjuk Ekspor Tiap OTA */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground space-y-2.5">
          <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
            <Info className="h-3.5 w-3.5 text-primary" />
            <span>Cara Mengunduh Berkas dari Extranet OTA:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-2.5 rounded-lg bg-background border border-border/40">
              <strong className="text-foreground block mb-0.5">Airbnb</strong>
              Masuk ke <em>Reservations</em> &gt; klik <em>Export (CSV)</em>, atau{" "}
              <em>Earnings / Payouts</em> &gt; <em>Transaction History</em>.
            </div>
            <div className="p-2.5 rounded-lg bg-background border border-border/40">
              <strong className="text-foreground block mb-0.5">Tiket.com</strong>
              Buka <em>Tiket Extranet</em> &gt; menu <em>Order List / Pesanan</em> &gt; klik tombol{" "}
              <em>Export CSV</em>.
            </div>
            <div className="p-2.5 rounded-lg bg-background border border-border/40">
              <strong className="text-foreground block mb-0.5">Traveloka</strong>
              Buka <em>Tera Extranet</em> &gt; menu <em>Booking List / Reservasi</em> &gt; klik{" "}
              <em>Unduh / Export CSV</em>.
            </div>
          </div>
        </div>

        {/* Tombol Eksekusi */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/bookings">Batal</Link>
          </Button>
          <Button type="submit" disabled={!file || isPending} className="gap-2 min-w-44 shadow-xs">
            {isPending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Memproses Ingest...</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                <span>Mulai Sinkronisasi</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
