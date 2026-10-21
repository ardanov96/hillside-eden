/**
 * Badge status data komisi (S2-07.4).
 *
 * Baris booking mungkin punya:
 * - `commissionAmount` terisi -> AKTUAL (badge hijau, ikon centang)
 * - hanya `commissionRate` -> ESTIMASI (badge kuning, ikon jam pasir)
 * - tidak ada keduanya -> BELUM LENGKAP (badge abu-abu, ikon tanya)
 *
 * Sumber: docs/07-ui-spec.md §4 + ADR-004 (estimasi vs aktual dibedakan).
 */
import type { CommissionBasis } from "@prisma/client";

import {
  type DataStatusBadge as DataStatusBadgeConfig,
  resolveDataStatus,
} from "@/lib/badges/badge-config";
import { CheckIcon, HourglassIcon, QuestionIcon } from "./icons";
import { BadgePill } from "./badge";

const ICON_BY_KIND = {
  AKTUAL: CheckIcon,
  ESTIMASI: HourglassIcon,
  BELUM_LENGKAP: QuestionIcon,
} as const;

export interface DataStatusBadgeProps {
  commissionAmount?: unknown;
  commissionRate?: unknown;
  commissionBasis?: CommissionBasis | null;
  /** Lewati turunan; gunakan nilai ini secara langsung (untuk laporan / uji). */
  override?: DataStatusBadgeConfig;
  className?: string;
  decorative?: boolean;
}

export function DataStatusBadge(props: DataStatusBadgeProps) {
  const cfg = props.override ?? resolveDataStatus(props);
  const Icon = ICON_BY_KIND[cfg.kind];
  return (
    <BadgePill
      label={cfg.label}
      tone={cfg.tone}
      icon={<Icon />}
      description={cfg.description}
      className={props.className}
      decorative={props.decorative}
    />
  );
}
