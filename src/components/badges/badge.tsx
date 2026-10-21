/**
 * BadgePill primitive (S2-07.4).
 *
 * Pembungkus visual bersama untuk semua badge. Komponen status / data
 * status / collect type hanya memilih data (label, tone, icon) lalu
 * me-render lewat sini. Memastikan konsistensi padding, tinggi minimal,
 * dan ikon wajib (a11y §6: "badge tidak hanya mengandalkan warna").
 *
 * - `role` default "status" saat komponen membawa data dinamis; gunakan
 *   `role="img"` untuk badge murni dekoratif via prop `decorative`.
 * - Ikon memakai <svg> inline (tidak menambah dependensi).
 * - Tinggi minimum 24px agar target sentuh cukup di form mobile (§6).
 */
import type { ReactNode } from "react";

import { type BadgeTone, BADGE_TONE_CLASS } from "@/lib/badges/badge-config";

export interface BadgePillProps {
  label: string;
  tone: BadgeTone;
  /** Ikon kecil (biasanya 16px). WAJIB ada; kontras ganda untuk a11y. */
  icon: ReactNode;
  /** Tooltip opsional (mouse) + aria-label tambahan saat label terlalu pendek. */
  description?: string;
  /** className tambahan (jarak/utilitas布局). */
  className?: string;
  /** Tandai badge sebagai dekoratif (skip role/aria). */
  decorative?: boolean;
}

export function BadgePill({
  label,
  tone,
  icon,
  description,
  className,
  decorative = false,
}: BadgePillProps) {
  const toneClass = BADGE_TONE_CLASS[tone];
  // Standarisasi: pill 24px, ikon di kiri, teks satu baris.
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 " +
    "min-h-[24px] text-xs font-medium whitespace-nowrap";
  return (
    <span
      className={[base, toneClass.bg, toneClass.text, toneClass.border, className]
        .filter(Boolean)
        .join(" ")}
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : (description ?? label)}
      title={description}
    >
      <span aria-hidden="true" className={`shrink-0 ${toneClass.dot}`}>
        {icon}
      </span>
      <span>{label}</span>
    </span>
  );
}
