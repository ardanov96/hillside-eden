/**
 * Badge status booking (S2-07.4).
 *
 * Memetakan `BookingStatus` ke label, tone, dan ikon. Server-renderable.
 * Sumber: docs/07-ui-spec.md §1 + §4.
 */
import type { BookingStatus } from "@prisma/client";

import { BOOKING_STATUS_BADGE } from "@/lib/badges/badge-config";
import { CheckIcon, CrossIcon, HourglassIcon, SlashIcon } from "./icons";
import { BadgePill } from "./badge";

const ICON_BY_STATUS: Record<BookingStatus, typeof CheckIcon> = {
  PENDING: HourglassIcon,
  CONFIRMED: CheckIcon,
  CANCELLED: CrossIcon,
  NO_SHOW: SlashIcon,
};

export type StatusBadgeProps = {
  status: BookingStatus;
  className?: string;
  decorative?: boolean;
};

export function StatusBadge({ status, className, decorative }: StatusBadgeProps) {
  const cfg = BOOKING_STATUS_BADGE[status];
  const Icon = ICON_BY_STATUS[status];
  return (
    <BadgePill
      label={cfg.label}
      tone={cfg.tone}
      icon={<Icon />}
      description={cfg.description}
      className={className}
      decorative={decorative}
    />
  );
}
