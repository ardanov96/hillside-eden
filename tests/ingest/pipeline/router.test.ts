/**
 * Unit test untuk router (S2-02.3).
 * Stub adapter dipakai untuk menguji resolve() multi-match AMBIGUOUS.
 */
import { describe, expect, it } from "vitest";
import type { ChannelCode, ParseResult, RawInput, SourceAdapter } from "@/adapters/types";
import {
  AdapterAmbiguousError,
  AdapterAlreadyRegisteredError,
  createRouterRegistry,
} from "@/ingest/pipeline/router";

function stubAdapter(
  id: string,
  channel: ChannelCode,
  matches: (input: RawInput) => boolean,
  parser: (input: RawInput) => ParseResult = () => ({ ok: true, events: [] }),
): SourceAdapter {
  return {
    id,
    channel,
    supports: matches,
    parse: parser,
  };
}

describe("createRouterRegistry", () => {
  it("register dan list adapter", () => {
    const r = createRouterRegistry();
    const csv = stubAdapter("csv.test.v1", "AIRBNB", (i) => i.kind === "csv");
    r.register(csv);
    expect(r.list()).toEqual([csv]);
  });

  it("register ulang dengan id yang sama throws AdapterAlreadyRegisteredError", () => {
    const r = createRouterRegistry();
    r.register(stubAdapter("csv.test.v1", "AIRBNB", () => false));
    expect(() => r.register(stubAdapter("csv.test.v1", "TIKET_COM", () => false))).toThrow(
      AdapterAlreadyRegisteredError,
    );
  });

  it("unregister menghapus adapter", () => {
    const r = createRouterRegistry();
    r.register(stubAdapter("csv.test.v1", "AIRBNB", () => false));
    r.unregister("csv.test.v1");
    expect(r.list()).toEqual([]);
  });

  it("resolve mengembalikan undefined saat tidak ada adapter cocok", () => {
    const r = createRouterRegistry([stubAdapter("csv.test.v1", "AIRBNB", (i) => i.kind === "csv")]);
    const input: RawInput = { kind: "ical", listingId: "L1", content: "" };
    expect(r.resolve(input)).toBeUndefined();
  });

  it("resolve mengembalikan adapter tunggal yang cocok", () => {
    const csv = stubAdapter("csv.test.v1", "AIRBNB", (i) => i.kind === "csv");
    const r = createRouterRegistry([csv]);
    expect(r.resolve({ kind: "csv", filename: "x.csv", content: "a,b\n" })).toBe(csv);
  });

  it("resolve throws AdapterAmbiguousError saat >1 cocok", () => {
    const a = stubAdapter("a.v1", "AIRBNB", () => true);
    const b = stubAdapter("b.v1", "AIRBNB", () => true);
    const r = createRouterRegistry([a, b]);
    expect(() => r.resolve({ kind: "csv", filename: "x", content: "" })).toThrow(
      AdapterAmbiguousError,
    );
  });

  it("parse mengembalikan UNSUPPORTED_FORMAT saat tidak ada adapter", async () => {
    const r = createRouterRegistry();
    const res = await r.parse({ kind: "csv", filename: "x.csv", content: "" });
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.errorCode).toBe("UNSUPPORTED_FORMAT");
    }
  });

  it("parse mengembalikan AMBIGUOUS (bukan throw) saat >1 cocok", async () => {
    const a = stubAdapter(
      "a.v1",
      "AIRBNB",
      () => true,
      () => ({
        ok: true,
        events: [],
      }),
    );
    const b = stubAdapter(
      "b.v1",
      "AIRBNB",
      () => true,
      () => ({
        ok: true,
        events: [],
      }),
    );
    const r = createRouterRegistry([a, b]);
    const res = await r.parse({ kind: "csv", filename: "x.csv", content: "" });
    expect(res.ok).toBe(false);
    if (res.ok === false) {
      expect(res.errorCode).toBe("AMBIGUOUS");
      expect(res.details).toEqual({ candidateAdapters: ["a.v1", "b.v1"] });
    }
  });

  it("parse memanggil adapter yang ter-resolve", async () => {
    let called = false;
    const adapter = stubAdapter(
      "ok.v1",
      "AIRBNB",
      () => true,
      () => {
        called = true;
        return { ok: true, events: [] };
      },
    );
    const r = createRouterRegistry([adapter]);
    await r.parse({ kind: "csv", filename: "x.csv", content: "" });
    expect(called).toBe(true);
  });

  it("parse menunggu adapter async", async () => {
    const adapter: SourceAdapter = {
      id: "async.v1",
      channel: "AIRBNB",
      supports: () => true,
      parse: async () => ({ ok: true, events: [] }),
    };
    const r = createRouterRegistry([adapter]);
    const res = await r.parse({ kind: "csv", filename: "x.csv", content: "" });
    expect(res.ok).toBe(true);
  });
});
