/**
 * Handler Auth.js v5 untuk App Router (lihat docs NextAuth v5).
 * Cukup re-export GET/POST dari handlers.
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
