/**
 * Chip kecil untuk halaman Bookings (S2-07.2).
 *
 * - ChannelChip: nama OTA pendek (Tiket.com, Airbnb, dll).
 *   Berbeda dari BadgeStatus: ini bukan status, melainkan label platform.
 */
import type { ChannelCode } from "@prisma/client";

const CHANNEL_LABEL: Record<ChannelCode, string> = {
  AIRBNB: "Airbnb",
  TIKET_COM: "Tiket.com",
  TRAVELOKA: "Traveloka",
  EXPEDIA: "Expedia",
  AGODA: "Agoda",
  BOOKING_COM: "Booking.com",
  DIRECT: "Direct",
  MANUAL: "Manual",
};

export function ChannelChip({ channel }: { channel: ChannelCode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {CHANNEL_LABEL[channel]}
    </span>
  );
}
