/**
 * Ikon kecil untuk badge (S2-07.4).
 *
 * Semua ikon inline <svg>, tanpa dependency tambahan. Ukuran default 14px
 * agar pas dengan BadgePill. Ikon menggunakan `currentColor` jadi warna
 * diwarisi dari parent (kelas `dot` tone).
 */
import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  size?: number;
};

function svgProps({ size = 14, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 20 20",
    fill: "currentColor",
    "aria-hidden": true,
    focusable: false,
    ...rest,
  } satisfies SVGProps<SVGSVGElement>;
}

/** Centang (Aktual / Dikonfirmasi / Diterima). */
export function CheckIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path
        fillRule="evenodd"
        d="M16.704 5.296a1 1 0 010 1.414l-7.5 7.5a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 011.414-1.414L8.5 12.086l6.79-6.79a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Tanda tanya kecil (Belum lengkap / Belum diketahui). */
export function QuestionIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-12.5a2.5 2.5 0 00-2.5 2.5 1 1 0 102 0 .5.5 0 011 0 .5.5 0 01-.5.5 1 1 0 00-1 1V11a1 1 0 102 0v-.79a2.5 2.5 0 00-.5-4.96zM10 14a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Jam pasir / Estimasi (sedang menunggu). */
export function HourglassIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path
        fillRule="evenodd"
        d="M5 3a1 1 0 011-1h8a1 1 0 011 1v2a4 4 0 01-2 3.464V8.5a1 1 0 01-2 0V8.464A4 4 0 0113 5V4H7v1a4 4 0 012 3.464V8.5a1 1 0 01-2 0V8.464A4 4 0 015 5V3zm0 14a1 1 0 011-1h8a1 1 0 011-1v-2a4 4 0 00-2-3.464V9.5a1 1 0 00-2 0v.036A4 4 0 007 13v2h6v-2a2 2 0 00-1-1.732V11.5a1 1 0 00-2 0v.768A4 4 0 007 16v1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Silang (Dibatalkan). */
export function CrossIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Slash / "Tidak hadir" (NO_SHOW). */
export function SlashIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.78-12.22a1 1 0 00-1.56 0l-5 8A1 1 0 005 15h10a1 1 0 00.78-1.22l-5-8z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Rumah (Hotel collect). */
export function HomeIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path
        fillRule="evenodd"
        d="M9.293 2.293a1 1 0 011.414 0l7 7a1 1 0 01-1.414 1.414L16 10v6a2 2 0 01-2 2h-2v-5h-2v5H8a2 2 0 01-2-2v-6l-.293.707a1 1 0 01-1.414-1.414l7-7z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Globe (Channel collect -> OTA). */
export function GlobeIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-13a1 1 0 112 0v.5a1 1 0 11-2 0V5zm-3.243.757a1 1 0 011.414 0l.354.354a1 1 0 11-1.414 1.414l-.354-.354a1 1 0 010-1.414zm7.486 0a1 1 0 010 1.414l-.354.354a1 1 0 11-1.414-1.414l.354-.354a1 1 0 011.414 0zM3 10a1 1 0 01.5-.866 1 1 0 011 1.732A1 1 0 013 10zm13 0a1 1 0 011-1 1 1 0 010 2 1 1 0 01-1-1zm-1.5 4.5a1 1 0 011.414 0l.354.354a1 1 0 11-1.414 1.414l-.354-.354a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}
