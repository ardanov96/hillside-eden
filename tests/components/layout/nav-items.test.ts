/**
 * Tes definisi menu navigasi (S4-01).
 *
 * Daftar menu adalah satu-satunya sumber kebenaran sidebar, jadi harus
 * konsisten: href unik, item "live" benar-benar punya route di repo, dan
 * item "planned" selalu menyertakan tiket rujukan (bukan link mati tanpa
 * penjelasan).
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_ITEMS } from "@/components/layout/nav-items";

const REPO_ROOT = process.cwd();

/** Route App Router yang setara dengan sebuah href navigasi. */
function routeFileFor(href: string): string {
  if (href === "/") return path.join(REPO_ROOT, "src", "app", "(app)", "page.tsx");
  return path.join(
    REPO_ROOT,
    "src",
    "app",
    "(app)",
    ...href.split("/").filter(Boolean),
    "page.tsx",
  );
}

describe("NAV_ITEMS", () => {
  it("tidak punya href duplikat", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("setiap item punya href, label, dan status yang valid", () => {
    for (const item of NAV_ITEMS) {
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.label.length).toBeGreaterThan(0);
      expect(["live", "planned"]).toContain(item.status);
    }
  });

  it("Ringkasan adalah item pertama", () => {
    expect(NAV_ITEMS[0]?.href).toBe("/");
    expect(NAV_ITEMS[0]?.label).toBe("Ringkasan");
  });

  it("item live punya file route yang benar-benar ada", () => {
    const live = NAV_ITEMS.filter((i) => i.status === "live");
    expect(live.length).toBeGreaterThan(0);
    for (const item of live) {
      expect(existsSync(routeFileFor(item.href))).toBe(true);
    }
  });

  it("item planned selalu punya tiket rujukan", () => {
    const planned = NAV_ITEMS.filter((i) => i.status === "planned");
    expect(planned.length).toBeGreaterThan(0);
    for (const item of planned) {
      expect(item.ticket).toMatch(/^S\d+-\d+$/);
    }
  });

  it("item planned belum punya route (kalau ada, statusnya harus di-update)", () => {
    for (const item of NAV_ITEMS) {
      if (item.status !== "planned") continue;
      expect({ href: item.href, ada: existsSync(routeFileFor(item.href)) }).toEqual({
        href: item.href,
        ada: false,
      });
    }
  });
});
