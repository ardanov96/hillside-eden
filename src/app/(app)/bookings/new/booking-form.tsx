"use client";
/**
 * Form Client Component untuk tambah booking manual (S2-04.3).
 *
 * - useActionState supaya error tampil inline tanpa reload.
 * - Nilai form dipertahankan saat validasi gagal (state.values).
 * - nights ditampilkan sebagai hitungan bantu (dihitung adapter, ditampilkan di sini).
 */
import { useActionState, useMemo } from "react";
import { createManualBookingAction, type BookingFormState } from "./actions";
import type { ListingOption } from "@/server/queries/listings";
import { Button } from "@/components/ui/button";

const initial: BookingFormState = {};

const INPUT_CLASS =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const LABEL_CLASS = "text-xs font-semibold text-foreground";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null;
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.join(" ")}</p>;
}

export function BookingForm({ listings }: { listings: readonly ListingOption[] }) {
  const [state, formAction, pending] = useActionState(createManualBookingAction, initial);

  const v = state.values ?? {};

  const nights = useMemo(() => {
    const ci = v.checkIn;
    const co = v.checkOut;
    if (!ci || !co) return null;
    const a = Date.parse(`${ci}T00:00:00Z`);
    const b = Date.parse(`${co}T00:00:00Z`);
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    const diff = Math.round((b - a) / 86_400_000);
    return diff > 0 ? diff : null;
    // values berubah setiap submit; state form adalah sumber tunggal.
  }, [v.checkIn, v.checkOut]);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300"
        >
          {state.error}
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Identitas pemesanan
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="externalId" className={LABEL_CLASS}>
              Kode referensi
            </label>
            <input
              id="externalId"
              name="externalId"
              type="text"
              required
              maxLength={64}
              defaultValue={v.externalId ?? ""}
              placeholder="MAN-2026-001"
              className={INPUT_CLASS}
            />
            <FieldError errors={state.fieldErrors?.externalId} />
          </div>

          <div className="space-y-2">
            <label htmlFor="listingId" className={LABEL_CLASS}>
              Listing
            </label>
            <select
              id="listingId"
              name="listingId"
              required
              defaultValue={v.listingId ?? ""}
              className={INPUT_CLASS}
            >
              <option value="">Pilih listing...</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label} ({l.unitCount} unit)
                </option>
              ))}
            </select>
            <FieldError errors={state.fieldErrors?.listingId} />
          </div>

          <div className="space-y-2">
            <label htmlFor="status" className={LABEL_CLASS}>
              Status
            </label>
            <select
              id="status"
              name="status"
              required
              defaultValue={v.status ?? "CONFIRMED"}
              className={INPUT_CLASS}
            >
              <option value="CONFIRMED">Terkonfirmasi</option>
              <option value="PENDING">Menunggu</option>
            </select>
            <FieldError errors={state.fieldErrors?.status} />
          </div>

          <div className="space-y-2">
            <label htmlFor="guestName" className={LABEL_CLASS}>
              Nama tamu (opsional)
            </label>
            <input
              id="guestName"
              name="guestName"
              type="text"
              maxLength={120}
              defaultValue={v.guestName ?? ""}
              className={INPUT_CLASS}
            />
            <FieldError errors={state.fieldErrors?.guestName} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Tanggal menginap
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="checkIn" className={LABEL_CLASS}>
              Check-in
            </label>
            <input
              id="checkIn"
              name="checkIn"
              type="date"
              required
              defaultValue={v.checkIn ?? ""}
              className={INPUT_CLASS}
            />
            <FieldError errors={state.fieldErrors?.checkIn} />
          </div>

          <div className="space-y-2">
            <label htmlFor="checkOut" className={LABEL_CLASS}>
              Check-out
            </label>
            <input
              id="checkOut"
              name="checkOut"
              type="date"
              required
              defaultValue={v.checkOut ?? ""}
              className={INPUT_CLASS}
            />
            <FieldError errors={state.fieldErrors?.checkOut} />
          </div>

          <div className="space-y-2">
            <span className={LABEL_CLASS}>Jumlah malam</span>
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
              {nights === null ? "-" : `${nights} malam`}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="bookedOn" className={LABEL_CLASS}>
              Tanggal dipesan (opsional)
            </label>
            <input
              id="bookedOn"
              name="bookedOn"
              type="date"
              defaultValue={v.bookedOn ?? ""}
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Bila tanggal pasti, hapus centang &ldquo;perkiraan&rdquo; di bawah.
            </p>
            <FieldError errors={state.fieldErrors?.bookedOn} />
          </div>

          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                id="bookedAtIsApprox"
                name="bookedAtIsApprox"
                type="checkbox"
                defaultChecked={v.bookedAtIsApprox !== "off"}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              Tanggal pemesanan adalah perkiraan
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Keuangan</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="currency" className={LABEL_CLASS}>
              Mata uang
            </label>
            <select
              id="currency"
              name="currency"
              defaultValue={v.currency ?? "IDR"}
              className={INPUT_CLASS}
            >
              <option value="IDR">IDR (Rp)</option>
              <option value="USD">USD ($)</option>
            </select>
            <FieldError errors={state.fieldErrors?.currency} />
          </div>

          <div className="space-y-2">
            <label htmlFor="grossAmount" className={LABEL_CLASS}>
              Pendapatan kotor
            </label>
            <input
              id="grossAmount"
              name="grossAmount"
              type="text"
              inputMode="numeric"
              required
              defaultValue={v.grossAmount ?? ""}
              placeholder="1.500.000"
              className={INPUT_CLASS}
            />
            <FieldError errors={state.fieldErrors?.grossAmount} />
          </div>

          <div className="space-y-2">
            <label htmlFor="cancellationFee" className={LABEL_CLASS}>
              Biaya pembatalan (opsional)
            </label>
            <input
              id="cancellationFee"
              name="cancellationFee"
              type="text"
              inputMode="numeric"
              defaultValue={v.cancellationFee ?? ""}
              className={INPUT_CLASS}
            />
            <FieldError errors={state.fieldErrors?.cancellationFee} />
          </div>

          <div className="space-y-2">
            <label htmlFor="commissionRate" className={LABEL_CLASS}>
              Rate komisi (opsional)
            </label>
            <input
              id="commissionRate"
              name="commissionRate"
              type="text"
              inputMode="decimal"
              defaultValue={v.commissionRate ?? ""}
              placeholder="15 atau 0.15"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Isi 15 untuk 15% atau 0.15 untuk fraksi.
            </p>
            <FieldError errors={state.fieldErrors?.commissionRate} />
          </div>

          <div className="space-y-2">
            <label htmlFor="commissionAmount" className={LABEL_CLASS}>
              Nominal komisi (opsional)
            </label>
            <input
              id="commissionAmount"
              name="commissionAmount"
              type="text"
              inputMode="numeric"
              defaultValue={v.commissionAmount ?? ""}
              className={INPUT_CLASS}
            />
            <FieldError errors={state.fieldErrors?.commissionAmount} />
          </div>

          <div className="space-y-2">
            <label htmlFor="collectType" className={LABEL_CLASS}>
              Siapa menagih
            </label>
            <select
              id="collectType"
              name="collectType"
              defaultValue={v.collectType ?? "UNKNOWN"}
              className={INPUT_CLASS}
            >
              <option value="UNKNOWN">Belum diketahui</option>
              <option value="CHANNEL_COLLECT">Ditagih OTA</option>
              <option value="HOTEL_COLLECT">Ditagih hotel</option>
            </select>
            <FieldError errors={state.fieldErrors?.collectType} />
          </div>

          <div className="space-y-2">
            <label htmlFor="guestsCount" className={LABEL_CLASS}>
              Jumlah tamu (opsional)
            </label>
            <input
              id="guestsCount"
              name="guestsCount"
              type="number"
              min={1}
              step={1}
              defaultValue={v.guestsCount ?? ""}
              className={INPUT_CLASS}
            />
            <FieldError errors={state.fieldErrors?.guestsCount} />
          </div>
        </div>
      </fieldset>

      <div className="flex items-center gap-3 pt-4 border-t border-border/60">
        <Button type="submit" disabled={pending} className="gap-2">
          {pending ? "Menyimpan..." : "Simpan booking"}
        </Button>
        {listings.length === 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Belum ada listing aktif. Tambahkan listing terlebih dahulu.
          </p>
        ) : null}
      </div>
    </form>
  );
}
