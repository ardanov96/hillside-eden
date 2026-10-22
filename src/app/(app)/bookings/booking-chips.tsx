import type { ChannelCode } from "@prisma/client";

const CHANNEL_CONFIG: Record<ChannelCode, { label: string; className: string }> = {
  AIRBNB: {
    label: "Airbnb",
    className:
      "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  },
  TIKET_COM: {
    label: "Tiket.com",
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  },
  TRAVELOKA: {
    label: "Traveloka",
    className:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  },
  EXPEDIA: {
    label: "Expedia",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  },
  AGODA: {
    label: "Agoda",
    className:
      "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
  },
  BOOKING_COM: {
    label: "Booking.com",
    className:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  },
  DIRECT: {
    label: "Direct",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
  MANUAL: {
    label: "Manual",
    className:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  },
};

export function ChannelChip({ channel }: { channel: ChannelCode }) {
  const conf = CHANNEL_CONFIG[channel] ?? {
    label: channel,
    className: "bg-muted text-foreground border-border",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-tight transition-colors shadow-2xs ${conf.className}`}
    >
      {conf.label}
    </span>
  );
}
