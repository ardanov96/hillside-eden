/**
 * Pipeline ingest dan penautan payout ke booking (Sprint 7 / S7-02).
 *
 * Menerima ParsedPayout[] dari adapter (mis. CSV riwayat transaksi Airbnb),
 * mencatat Payout, menautkan ke Booking via PayoutBooking, memperbarui
 * status komisi menjadi ACTUAL, dan mencatat event PAYOUT_LINKED serta AuditLog.
 *
 * Sumber kebenaran: docs/06 §9, docs/05 §5, docs/04 model Payout & PayoutBooking.
 */
import type { PrismaClient } from "@prisma/client";
import { Decimal } from "@/lib/decimal";
import { money, round, sub } from "@/lib/money";
import { isStayDate, toStayDate, type StayDate } from "@/lib/dates";
import type { ChannelCode, ParsedPayout } from "@/adapters/types";
import { AUDIT_ACTIONS, writeAudit } from "./audit";

export interface LinkPayoutsInput {
  organizationId: string;
  actorId?: string | null;
  importBatchId?: string | null;
  payouts: ParsedPayout[];
}

export interface PayoutLinkingSummary {
  totalPayouts: number;
  createdPayouts: number;
  linkedBookings: number;
  unmatchedBookings: number;
  warnings: string[];
  payouts: Array<{
    id: string;
    reference: string;
    channel: ChannelCode;
    amount: string;
    currency: string;
    payoutDate: StayDate;
    linkedBookingIds: string[];
  }>;
}

/**
 * Memproses dan menautkan daftar payout ke booking dalam database.
 */
export async function linkPayouts(
  prisma: PrismaClient,
  input: LinkPayoutsInput,
): Promise<PayoutLinkingSummary> {
  const { organizationId, actorId, importBatchId, payouts } = input;

  const result: PayoutLinkingSummary = {
    totalPayouts: payouts.length,
    createdPayouts: 0,
    linkedBookings: 0,
    unmatchedBookings: 0,
    warnings: [],
    payouts: [],
  };

  for (const p of payouts) {
    const rawDate = p.payoutDate instanceof Date ? toStayDate(p.payoutDate) : p.payoutDate;
    const stayDate: StayDate = isStayDate(rawDate) ? rawDate : "1970-01-01";
    const payoutDateTime = new Date(`${stayDate}T00:00:00.000Z`);

    const payoutAmountDec = new Decimal(p.amount);
    const currency = p.currency.toUpperCase() as "IDR" | "USD";
    const places = currency === "IDR" ? 0 : 2;

    // 1. Cari atau buat record Payout
    let payoutRecord = await prisma.payout.findFirst({
      where: {
        organizationId,
        channel: p.channel,
        reference: p.reference,
      },
    });

    if (!payoutRecord) {
      payoutRecord = await prisma.payout.create({
        data: {
          organizationId,
          channel: p.channel,
          payoutDate: payoutDateTime,
          currency,
          amount: payoutAmountDec,
          reference: p.reference,
          importBatchId: importBatchId ?? null,
        },
      });
      result.createdPayouts++;

      await writeAudit(prisma, {
        organizationId,
        actorId: actorId ?? null,
        action: AUDIT_ACTIONS.payoutCreated,
        entityType: "Payout",
        entityId: payoutRecord.id,
        after: {
          channel: p.channel,
          reference: p.reference,
          amount: p.amount,
          currency,
          payoutDate: stayDate,
        },
      });
    }

    const linkedBookingIds: string[] = [];

    // 2. Tautkan ke booking terkait (bookingExternalIds)
    if (p.bookingExternalIds.length > 0) {
      // Hitung pembagian jumlah payout bila terdapat beberapa booking dalam 1 payout
      const singleAllocation = payoutAmountDec.dividedBy(p.bookingExternalIds.length);
      const allocatedPerBooking = round(money(singleAllocation, currency), places).amount;

      for (const externalId of p.bookingExternalIds) {
        const booking = await prisma.booking.findUnique({
          where: {
            organizationId_channel_externalId: {
              organizationId,
              channel: p.channel,
              externalId,
            },
          },
        });

        if (!booking) {
          result.unmatchedBookings++;
          result.warnings.push(
            `Booking tidak ditemukan untuk payout ref=${p.reference}, externalId=${externalId}`,
          );
          continue;
        }

        linkedBookingIds.push(booking.id);

        // Cek apakah relasi PayoutBooking sudah ada (idempotency)
        const existingLink = await prisma.payoutBooking.findUnique({
          where: {
            payoutId_bookingId: {
              payoutId: payoutRecord.id,
              bookingId: booking.id,
            },
          },
        });

        if (!existingLink) {
          await prisma.payoutBooking.create({
            data: {
              payoutId: payoutRecord.id,
              bookingId: booking.id,
              amount: allocatedPerBooking,
            },
          });
          result.linkedBookings++;
        }

        // 3. Perbarui Booking: Actual Commission & CollectType
        const grossMoney = money(booking.grossAmount.toString(), currency);
        const payoutMoney = money(allocatedPerBooking.toString(), currency);

        // Komisi aktual = grossAmount - payoutAmount (untuk CHANNEL_COLLECT)
        let actualCommissionAmount = sub(grossMoney, payoutMoney).amount;
        if (actualCommissionAmount.isNegative()) {
          actualCommissionAmount = new Decimal(0);
        }

        const effectiveRate = booking.grossAmount.isZero()
          ? new Decimal(0)
          : actualCommissionAmount.dividedBy(booking.grossAmount);

        const previousCommission = booking.commissionAmount?.toString() ?? null;
        const previousBasis = booking.commissionBasis;

        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            commissionAmount: actualCommissionAmount,
            commissionRate: effectiveRate,
            commissionBasis: "ACTUAL",
            collectType: "CHANNEL_COLLECT",
          },
        });

        // 4. Catat BookingEvent: PAYOUT_LINKED
        const eventOccurredAt = payoutDateTime;
        try {
          await prisma.bookingEvent.create({
            data: {
              bookingId: booking.id,
              type: "PAYOUT_LINKED",
              occurredAt: eventOccurredAt,
              diff: {
                payoutId: payoutRecord.id,
                reference: p.reference,
                payoutAmount: allocatedPerBooking.toString(),
                previousCommission,
                actualCommission: actualCommissionAmount.toString(),
                previousBasis,
                newBasis: "ACTUAL",
              },
            },
          });
        } catch (err: unknown) {
          // Abaikan bila event identik sudah ada (unique constraint)
          const isUnique =
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code: string }).code === "P2002";
          if (!isUnique) throw err;
        }

        // 5. Tulis Audit Log
        await writeAudit(prisma, {
          organizationId,
          actorId: actorId ?? null,
          action: AUDIT_ACTIONS.payoutLinked,
          entityType: "Booking",
          entityId: booking.id,
          before: {
            commissionAmount: previousCommission,
            commissionBasis: previousBasis,
          },
          after: {
            payoutId: payoutRecord.id,
            reference: p.reference,
            payoutAmount: allocatedPerBooking.toString(),
            commissionAmount: actualCommissionAmount.toString(),
            commissionBasis: "ACTUAL",
          },
        });
      }
    }

    result.payouts.push({
      id: payoutRecord.id,
      reference: payoutRecord.reference ?? p.reference,
      channel: payoutRecord.channel,
      amount: payoutRecord.amount.toString(),
      currency: payoutRecord.currency,
      payoutDate: stayDate,
      linkedBookingIds,
    });
  }

  return result;
}
