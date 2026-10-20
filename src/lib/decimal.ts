/**
 * Re-export Decimal dari @prisma/client untuk konsistensi import.
 * Pakai Prisma.Decimal (bukan top-level) untuk kompatibilitas generator.
 * Decimal.js kompatibel dengan json-stringify dan dipakai Prisma untuk kolom Decimal.
 */
import { Prisma } from "@prisma/client";

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;
export type DecimalJsLike = Prisma.DecimalJsLike;
