/**
 * Tampilan detail booking (S2-07.3) - Server Component.
 *
 * Isi mengikuti docs/07-ui-spec.md §3.2: ringkasan, alokasi unit, komisi
 * (estimasi/aktual), riwayat perubahan (`booking_event`), dan asal item impor.
 *
 * Angka tetap Decimal; pemformatan memakai `src/lib/format-id.ts`.
 */
import Link from "next/link";
import { ArrowLeft, FileUp, History, Layers, Users } from "lucide-react";
import type { CommissionBasis } from "@prisma/client";

import { ChannelChip } from "../booking-chips";
import { StatusBadge } from "@/components/badges/status-badge";
import { DataStatusBadge } from "@/components/badges/data-status-badge";
import { CollectTypeBadge } from "@/components/badges/collect-type-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateShort, formatNumberId, formatPercentId } from "@/lib/format-id";
import { formatTimestampWITA } from "@/lib/dates";
import {
  EVENT_TYPE_LABEL,
  IMPORT_ITEM_STATUS_LABEL,
  IMPORT_KIND_LABEL,
  summarizeDiff,
} from "@/lib/booking-detail";
import type { BookingDetail } from "@/server/queries/bookings";

export interface BookingDetailViewProps {
  detail: BookingDetail;
}

const RAW_PAYLOAD_LIMIT = 4000;

export function BookingDetailView({ detail }: BookingDetailViewProps) {
  const currency = detail.currency === "USD" ? "USD" : "IDR";
  const commissionBasis = detail.commissionBasis as CommissionBasis | null;
  const commission = detail.commissionAmount;
  const commissionRate = detail.commissionRate;
  const net = detail.netAmount;
  const hasTaxes = !detail.taxesCollected.isZero();
  const hasCancellationFee = !detail.cancellationFee.isZero();
  const latestImportItem = detail.events.find((e) => e.importItemStatus !== null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Daftar Booking</span>
        </Link>
        <span className="font-mono text-[11px] text-muted-foreground">ID: {detail.id}</span>
      </div>

      <header className="flex flex-wrap items-center gap-3">
        <ChannelChip channel={detail.channel} />
        <h1 className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {detail.externalId}
        </h1>
        <StatusBadge status={detail.status} />
        {detail.bookedAtIsApprox && (
          <Badge variant="outline" className="text-[11px]">
            Tanggal pemesanan perkiraan
          </Badge>
        )}
      </header>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* ---------------- Ringkasan ---------------- */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Ringkasan</CardTitle>
            <CardDescription>
              Identitas reservasi, masa menginap, dan model pembayarannya.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Field label="Properti" value={detail.property.name} />
              <Field
                label="Listing"
                value={
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span>{detail.listing.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {detail.listing.externalId}
                    </span>
                  </span>
                }
              />
              <Field
                label="Masa menginap"
                value={
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span>
                      {formatDateShort(detail.checkIn)} &rarr; {formatDateShort(detail.checkOut)}
                    </span>
                    <Badge variant="outline" className="text-[11px]">
                      {detail.nights} malam
                    </Badge>
                  </span>
                }
              />
              <Field
                label="Jumlah tamu"
                value={
                  detail.guestsCount === null ? (
                    "-"
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {detail.guestsCount} orang
                    </span>
                  )
                }
              />
              <Field
                label="Tanggal pemesanan"
                value={
                  detail.bookedAt ? formatDateShort(detail.bookedAt) : "Tidak ada di sumber data"
                }
              />
              <Field
                label="Model pembayaran"
                value={<CollectTypeBadge collectType={detail.collectType} />}
              />
              <Field label="Mata uang" value={detail.currency} />
              <Field
                label="Kurs ke mata uang dasar"
                value={
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span>{formatNumberId(detail.fxRateToBase, { fractionDigits: 4 })}</span>
                    {detail.fxRateSource && (
                      <span className="text-xs text-muted-foreground">
                        sumber: {detail.fxRateSource}
                      </span>
                    )}
                  </span>
                }
              />
              <Field label="Terakhir dilihat" value={formatTimestampWITA(detail.lastSeenAt)} />
            </dl>

            {detail.guest && (detail.guest.displayName || detail.guest.countryCode) && (
              <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
                <span className="font-medium text-foreground">Data tamu:</span>{" "}
                <span className="text-muted-foreground">
                  {detail.guest.displayName ?? "Tanpa nama"}
                  {detail.guest.countryCode ? ` · ${detail.guest.countryCode}` : ""}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---------------- Nilai booking ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nilai Booking</CardTitle>
            <CardDescription>Gross dan pendapatan bersih ditampilkan berdampingan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Nilai booking (gross)
              </span>
              <div className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                {formatCurrency(detail.grossAmount, currency)}
              </div>
            </div>

            <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-amber-900">
                  Komisi OTA
                </span>
                <DataStatusBadge
                  commissionAmount={commission}
                  commissionRate={commissionRate}
                  commissionBasis={commissionBasis}
                />
              </div>
              <div className="mt-1 text-xl font-bold tracking-tight text-amber-900">
                {commission === null ? "Belum ada data" : formatCurrency(commission, currency)}
              </div>
              {commissionRate !== null && (
                <p className="mt-0.5 text-[11px] text-amber-700/90">
                  Rate {formatPercentId(commissionRate)} dari nilai gross
                </p>
              )}
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-950">
                Pendapatan bersih (setelah komisi OTA)
              </span>
              <div className="mt-1 text-xl font-bold tracking-tight text-emerald-800">
                {net === null ? "Belum bisa dihitung" : formatCurrency(net, currency)}
              </div>
              {net === null && (
                <p className="mt-0.5 text-[11px] text-emerald-700/90">
                  Menunggu data komisi dari OTA.
                </p>
              )}
            </div>

            {(hasTaxes || hasCancellationFee) && (
              <dl className="space-y-1 border-t border-border/70 pt-3 text-xs">
                {hasTaxes && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Pajak dipungut</dt>
                    <dd className="font-medium tabular-nums">
                      {formatCurrency(detail.taxesCollected, currency)}
                    </dd>
                  </div>
                )}
                {hasCancellationFee && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Biaya pembatalan</dt>
                    <dd className="font-medium tabular-nums">
                      {formatCurrency(detail.cancellationFee, currency)}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------------- Alokasi unit ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alokasi Unit</CardTitle>
          <CardDescription>
            Pembagian nilai booking ke unit yang dijual pada listing ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.units.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Booking ini belum dialokasikan ke unit tertentu.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/70">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                    >
                      Unit
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right text-xs font-medium text-muted-foreground"
                    >
                      Nilai dialokasikan
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right text-xs font-medium text-muted-foreground"
                    >
                      Porsi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {detail.units.map((u) => (
                    <tr key={u.unitId}>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                          {u.unitName}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(u.allocatedGross, currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatPercentId(u.allocationPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Riwayat perubahan ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Perubahan</CardTitle>
          <CardDescription>
            Setiap perubahan status, tanggal, dan nilai tersimpan sebagai event booking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada riwayat perubahan.</p>
          ) : (
            <ol className="space-y-4">
              {detail.events.map((event) => {
                const changes = summarizeDiff(event.diff);
                return (
                  <li key={event.id} className="border-l-2 border-border pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                        {EVENT_TYPE_LABEL[event.type] ?? event.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestampWITA(event.occurredAt)}
                      </span>
                      {event.importBatch?.filename && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <FileUp className="h-3 w-3" />
                          <span className="font-mono">{event.importBatch.filename}</span>
                        </span>
                      )}
                    </div>
                    {changes.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs">
                        {changes.map((change) => (
                          <li key={change.field} className="flex flex-wrap items-baseline gap-1.5">
                            <span className="font-medium text-foreground">{change.label}:</span>
                            <span className="text-muted-foreground line-through">
                              {change.from}
                            </span>
                            <span aria-hidden className="text-muted-foreground">
                              &rarr;
                            </span>
                            <span className="font-medium text-foreground">{change.to}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Asal data ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asal Data</CardTitle>
          <CardDescription>
            Jejak booking ini back to berkas atau batch impor asalnya.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.importBatch ? (
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Field
                label="Sumber"
                value={IMPORT_KIND_LABEL[detail.importBatch.kind] ?? detail.importBatch.kind}
              />
              <Field label="Nama berkas" value={detail.importBatch.filename ?? "-"} />
              <Field
                label="Waktu impor"
                value={formatTimestampWITA(detail.importBatch.receivedAt)}
              />
              <Field
                label="ID batch"
                value={<span className="font-mono">{detail.importBatch.id}</span>}
              />
              {latestImportItem?.importItemStatus && (
                <Field
                  label="Status item impor"
                  value={
                    IMPORT_ITEM_STATUS_LABEL[latestImportItem.importItemStatus] ??
                    latestImportItem.importItemStatus
                  }
                />
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Booking ini tidak berasal dari impor berkas (input manual).
            </p>
          )}

          {detail.events.some(
            (e) => e.importItemStatus === "FAILED" || e.importItemStatus === "NEEDS_REVIEW",
          ) && (
            <p className="mt-3 text-xs text-amber-700">
              Sebagian item impor untuk booking ini berstatus perlu ditinjau.{" "}
              <Link href="/attention" className="font-medium underline">
                Buka Kotak Masuk Perlu Perhatian
              </Link>
              .
            </p>
          )}

          {detail.rawPayload !== null && detail.rawPayload !== undefined && (
            <details className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
              <summary className="cursor-pointer font-medium text-foreground">
                Lihat data mentah dari sumber
              </summary>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
                {truncateRawPayload(detail.rawPayload)}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Satu baris label/nilai pada ringkasan. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

/** Potong payload mentah yang terlalu panjang supaya halaman tetap ringan. */
function truncateRawPayload(payload: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(payload, null, 2) ?? String(payload);
  } catch {
    text = String(payload);
  }
  if (text.length <= RAW_PAYLOAD_LIMIT) return text;
  return `${text.slice(0, RAW_PAYLOAD_LIMIT)}\n... (dipotong, total ${text.length} karakter)`;
}
