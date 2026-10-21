/**
 * Badge model bayar (S2-07.4).
 *
 * Memetakan `CollectType` ke label, tone, dan ikon.
 * Sumber: docs/07-ui-spec.md §1.
 */
import type { CollectType } from "@prisma/client";

import { COLLECT_TYPE_BADGE } from "@/lib/badges/badge-config";
import { GlobeIcon, HomeIcon, QuestionIcon } from "./icons";
import { BadgePill } from "./badge";

const ICON_BY_COLLECT = {
  CHANNEL_COLLECT: GlobeIcon,
  HOTEL_COLLECT: HomeIcon,
  UNKNOWN: QuestionIcon,
} as const;

export type CollectTypeBadgeProps = {
  collectType: CollectType;
  className?: string;
  decorative?: boolean;
};

export function CollectTypeBadge({ collectType, className, decorative }: CollectTypeBadgeProps) {
  const cfg = COLLECT_TYPE_BADGE[collectType];
  const Icon = ICON_BY_COLLECT[collectType];
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
