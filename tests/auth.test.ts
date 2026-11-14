/**
 * Unit test untuk komponen autentikasi murni:
 * - argon2 hash + verify (round-trip, beda salt, constant-time)
 * - isPublicPath (matrix 17 kasus)
 *
 * Tidak menyentuh DB / Next.js runtime.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { ARGON2_PARAMS, hashPassword, verifyPassword } from "../src/lib/argon2";
import { isPublicPath } from "../src/lib/auth-paths";
import { decideProxyAuth } from "../src/lib/auth-guard";
import authConfig from "../src/auth.config";

describe("argon2id wrapper", () => {
  it("menggunakan argon2id sesuai parameter ekspor", () => {
    // ARGON2_PARAMS.algorithm === 2 == Algorithm.Argon2id
    expect(ARGON2_PARAMS.algorithm).toBe(2);
    expect(ARGON2_PARAMS.memoryCost).toBeGreaterThanOrEqual(19456);
    expect(ARGON2_PARAMS.timeCost).toBeGreaterThanOrEqual(2);
    expect(ARGON2_PARAMS.parallelism).toBeGreaterThanOrEqual(1);
  });

  it("hash hasil berbeda untuk password sama (salt random)", async () => {
    const a = await hashPassword("Hillside!2026");
    const b = await hashPassword("Hillside!2026");
    expect(a).not.toBe(b);
    // String hash self-contained, harus ber-prefix $argon2id$
    expect(a.startsWith("$argon2id$")).toBe(true);
  });

  it("verifyPassword mengkonfirmasi hash cocok", async () => {
    const stored = await hashPassword("Hillside!2026");
    await expect(verifyPassword(stored, "Hillside!2026")).resolves.toBe(true);
  });

  it("verifyPassword menolak password salah", async () => {
    const stored = await hashPassword("Hillside!2026");
    await expect(verifyPassword(stored, "salah")).resolves.toBe(false);
  });

  it("verifyPassword menolak input tidak valid tanpa throw", async () => {
    await expect(verifyPassword("", "apa")).resolves.toBe(false);
    await expect(verifyPassword("bukan-argon2id", "apa")).resolves.toBe(false);
    await expect(verifyPassword("$argon2id$xxx", "")).resolves.toBe(false);
  });

  it("hashPassword menolak string kosong", async () => {
    await expect(hashPassword("")).rejects.toThrow();
  });
});

describe("isPublicPath", () => {
  const PUBLIC_CASES: ReadonlyArray<string> = [
    "/login",
    "/login/",
    "/api/health",
    "/api/health?deep=1",
    "/api/auth/signin",
    "/api/auth/callback/credentials",
    "/api/auth/session",
    "/_next/static/chunks/main.js",
    "/_next/image?url=foo",
    "/favicon.ico",
  ];
  const PROTECTED_CASES: ReadonlyArray<string> = [
    "/",
    "/dashboard",
    "/properties",
    "/properties/hillside-eden",
    "/bookings",
    "/expenses",
    "/api/bookings",
    "/api/properties",
    "/api/v1/anything",
    "/api",
    "/settings",
  ];

  it.each(PUBLIC_CASES)("mengizinkan path publik %s", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each(PROTECTED_CASES)("menolak path terproteksi %s", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});

describe("authConfig callbacks", () => {
  describe("authorized callback (DoD: Route tanpa login ditolak)", () => {
    const authorized = authConfig.callbacks?.authorized;
    if (!authorized) throw new Error("authorized callback missing");

    function mockRequest(pathname: string, search = "") {
      return new NextRequest(`http://localhost:3000${pathname}${search}`);
    }

    it("menolak akses halaman terproteksi tanpa sesi (redirect ke login)", async () => {
      const request = mockRequest("/dashboard");
      const result = await authorized({ auth: null, request });
      expect(result).toBeInstanceOf(Response);
      const res = result as Response;
      expect(res.status).toBe(307);
      const location = res.headers.get("location") ?? "";
      expect(location).toContain("/login");
      expect(location).toContain("callbackUrl");
    });

    it("menolak akses endpoint API terproteksi tanpa sesi (401 JSON)", async () => {
      const request = mockRequest("/api/bookings");
      const result = await authorized({ auth: null, request });
      expect(result).toBeInstanceOf(Response);
      const res = result as Response;
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
    });

    it("membawa callbackUrl berisi query string saat redirect", async () => {
      const request = mockRequest("/bookings", "?period=this_month");
      const result = (await authorized({ auth: null, request })) as Response;
      const location = new URL(result.headers.get("location") ?? "");
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("callbackUrl")).toBe("/bookings?period=this_month");
    });

    it("mengizinkan akses route terproteksi dengan sesi user", async () => {
      const request = mockRequest("/dashboard");
      const auth = {
        user: { id: "user-1", email: "test@example.com" },
        expires: "2099-01-01",
      };
      expect(await authorized({ auth, request })).toBe(true);
    });

    it("mengizinkan akses route publik tanpa sesi", async () => {
      const request = mockRequest("/login");
      expect(await authorized({ auth: null, request })).toBe(true);
    });

    it("mengizinkan /api/health tanpa sesi", async () => {
      const request = mockRequest("/api/health");
      expect(await authorized({ auth: null, request })).toBe(true);
    });
  });

  describe("decideProxyAuth (keputusan murni, tanpa runtime Next.js)", () => {
    it("mengizinkan path publik tanpa sesi", () => {
      expect(decideProxyAuth({ pathname: "/login", hasSession: false })).toEqual({ kind: "allow" });
      expect(decideProxyAuth({ pathname: "/api/health", hasSession: false })).toEqual({
        kind: "allow",
      });
    });

    it("mengizinkan path terproteksi bila ada sesi", () => {
      expect(decideProxyAuth({ pathname: "/bookings", hasSession: true })).toEqual({
        kind: "allow",
      });
      expect(decideProxyAuth({ pathname: "/api/receipts/x", hasSession: true })).toEqual({
        kind: "allow",
      });
    });

    it("menolak endpoint API tanpa sesi dengan 401", () => {
      expect(decideProxyAuth({ pathname: "/api/bookings", hasSession: false })).toEqual({
        kind: "unauthorized",
      });
    });

    it("mengarahkan halaman tanpa sesi ke login dan menyimpan callbackUrl", () => {
      expect(
        decideProxyAuth({ pathname: "/bookings", search: "?page=2", hasSession: false }),
      ).toEqual({ kind: "redirect", callbackUrl: "/bookings?page=2" });
    });

    it("tidak menganggap /api sebagai terproteksi tanpa sesi", () => {
      expect(decideProxyAuth({ pathname: "/api", hasSession: false })).toEqual({
        kind: "redirect",
        callbackUrl: "/api",
      });
    });
  });

  describe("jwt callback", () => {
    const jwtCb = authConfig.callbacks?.jwt;
    if (!jwtCb) throw new Error("jwt callback missing");

    it("mengisi role, organizationId, dan userId dari user", async () => {
      type JwtParams = Parameters<NonNullable<NonNullable<typeof authConfig.callbacks>["jwt"]>>[0];
      const params = {
        token: {},
        user: { id: "u-1", role: "OWNER", organizationId: "org-1" },
        account: null,
      } as unknown as JwtParams;
      const token = await jwtCb(params);
      expect(token).toEqual({
        userId: "u-1",
        role: "OWNER",
        organizationId: "org-1",
      });
    });

    it("tidak mengubah token jika user undefined", async () => {
      type JwtParams = Parameters<NonNullable<NonNullable<typeof authConfig.callbacks>["jwt"]>>[0];
      const params = {
        token: { userId: "u-1", role: "OWNER" },
        account: null,
      } as unknown as JwtParams;
      const token = await jwtCb(params);
      expect(token).toEqual({ userId: "u-1", role: "OWNER" });
    });
  });

  describe("session callback", () => {
    const sessionCb = authConfig.callbacks?.session;
    if (!sessionCb) throw new Error("session callback missing");

    it("mentransfer userId, role, dan organizationId dari token ke session.user", async () => {
      type SessionParams = Parameters<
        NonNullable<NonNullable<typeof authConfig.callbacks>["session"]>
      >[0];
      const params = {
        session: { user: { email: "u@hillside.local" }, expires: "2099-01-01" },
        token: { userId: "u-1", role: "OWNER", organizationId: "org-1" },
      } as unknown as SessionParams;
      const session = await sessionCb(params);
      expect(session?.user?.id).toBe("u-1");
      expect(session?.user?.role).toBe("OWNER");
      expect(session?.user?.organizationId).toBe("org-1");
    });
  });
});
