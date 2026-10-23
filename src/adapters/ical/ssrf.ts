/**
 * Validasi URL iCal dan pencegahan SSRF (Server-Side Request Forgery).
 * Tiket: S5-04.
 *
 * Mencegah eksploitasi request internal (AWS metadata 169.254.169.254, localhost,
 * intranet 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, IPv6 loopback, dll).
 */
import { promises as dns } from "node:dns";
import { isIP } from "node:net";

export class SsrfBlockedError extends Error {
  readonly ip?: string;
  readonly url: string;

  constructor(message: string, url: string, ip?: string) {
    super(message);
    this.name = "SsrfBlockedError";
    this.url = url;
    this.ip = ip;
  }
}

/**
 * Cek apakah sebuah alamat IPv4 masuk dalam blok privat/reserved.
 */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed dianggap tidak aman
  }

  const a = parts[0]!;
  const b = parts[1]!;
  const c = parts[2]!;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 10.0.0.0/8 (RFC 1918 Private)
  if (a === 10) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link-local & Cloud Instance Metadata Services)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (RFC 1918 Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (RFC 1918 Private)
  if (a === 192 && b === 168) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (Documentation/TEST-NET)
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;

  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) return true;

  return false;
}

/**
 * Cek apakah sebuah alamat IPv6 masuk dalam blok privat/reserved.
 */
export function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback ::1
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;

  // Unspecified ::
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;

  // IPv4-mapped IPv6 (::ffff:192.0.2.1)
  if (normalized.startsWith("::ffff:")) {
    const ipv4Part = normalized.slice(7);
    if (isIP(ipv4Part) === 4) {
      return isPrivateIPv4(ipv4Part);
    }
  }

  // Unique Local Address fc00::/7 (fc00:: - fdff::)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  // Link-Local Address fe80::/10 (fe80:: - febf::)
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  return false;
}

/**
 * Validasi URL agar aman dari SSRF sebelum dilakukan pemanggilan jaringan.
 * Mengembalikan alamat IP publik yang telah divalidasi.
 */
export async function validateSsrfSafeUrl(rawUrl: string): Promise<{
  validUrl: URL;
  resolvedIp: string;
}> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError(`URL tidak valid: ${rawUrl}`, rawUrl);
  }

  // Protokol hanya http atau https
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new SsrfBlockedError(`Protokol tidak diizinkan: ${parsed.protocol}`, rawUrl);
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    throw new SsrfBlockedError("Hostname kosong", rawUrl);
  }

  // Periksa jika hostname adalah literal IP
  const ipType = isIP(hostname);
  if (ipType === 4) {
    if (isPrivateIPv4(hostname)) {
      throw new SsrfBlockedError(`IP privat tidak diizinkan: ${hostname}`, rawUrl, hostname);
    }
    return { validUrl: parsed, resolvedIp: hostname };
  }
  if (ipType === 6) {
    if (isPrivateIPv6(hostname)) {
      throw new SsrfBlockedError(`IP privat tidak diizinkan: ${hostname}`, rawUrl, hostname);
    }
    return { validUrl: parsed, resolvedIp: hostname };
  }

  // Resolve hostname via DNS
  let records: Array<{ address: string; family: number }>;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch (err) {
    throw new SsrfBlockedError(
      `Gagal me-resolve DNS untuk host ${hostname}: ${(err as Error).message}`,
      rawUrl,
    );
  }

  if (!records || records.length === 0) {
    throw new SsrfBlockedError(`DNS lookup menghasilkan 0 alamat IP untuk ${hostname}`, rawUrl);
  }

  for (const record of records) {
    if (record.family === 4 && isPrivateIPv4(record.address)) {
      throw new SsrfBlockedError(
        `Host ${hostname} me-resolve ke IP privat tidak diizinkan: ${record.address}`,
        rawUrl,
        record.address,
      );
    }
    if (record.family === 6 && isPrivateIPv6(record.address)) {
      throw new SsrfBlockedError(
        `Host ${hostname} me-resolve ke IP privat tidak diizinkan: ${record.address}`,
        rawUrl,
        record.address,
      );
    }
  }

  return { validUrl: parsed, resolvedIp: records[0]!.address };
}
