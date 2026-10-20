/**
 * Router adapter (S2-02.3).
 *
 * Tujuan: pilih SATU adapter yang sesuai untuk sebuah RawInput. Lebih dari
 * satu adapter cocok -> AMBIGUOUS (sesuai ParseErrorCode & rencana S2-02).
 *
 * Sumber kebenaran: docs/06 §2 (kontrak SourceAdapter), docs/06 §4 (parser
 * dipanggil via pipeline -> adapter.parse()).
 *
 * Prinsip:
 * - Murni: tidak ada I/O DB di sini (profil pemetaan dimuat oleh caller).
 * - Registrasi dilakukan manual oleh pipeline/seed.
 * - Order registrasi tidak menentukan prioritas; supports() bersifat
 *   deterministik dan dipanggil sekali.
 *
 * Batasan Sprint 2:
 * - Adapter yang terdaftar pada pipeline.runIngest level: GenericCsvAdapter.
 * - Adapter MANUAL akan ditambahkan oleh S2-04 (lihat DECISIONS.md "Open").
 */
import type { ParseResult, RawInput, SourceAdapter } from "@/adapters/types";

export interface RouterRegistry {
  register(adapter: SourceAdapter): void;
  unregister(adapterId: string): void;
  list(): readonly SourceAdapter[];
  resolve(input: RawInput): SourceAdapter | undefined;
  parse(input: RawInput): Promise<ParseResult>;
}

export class AdapterAmbiguousError extends Error {
  readonly matches: readonly string[];
  constructor(matches: readonly string[]) {
    super(`Multiple adapters support this input: ${matches.join(", ")}`);
    this.name = "AdapterAmbiguousError";
    this.matches = matches;
  }
}

export class AdapterAlreadyRegisteredError extends Error {
  constructor(id: string) {
    super(`Adapter id '${id}' sudah terdaftar`);
    this.name = "AdapterAlreadyRegisteredError";
  }
}

function buildRegistry(initial: ReadonlyArray<SourceAdapter> = []): RouterRegistry {
  const adapters = new Map<string, SourceAdapter>();
  for (const a of initial) {
    adapters.set(a.id, a);
  }

  function resolve(input: RawInput): SourceAdapter | undefined {
    const matches: SourceAdapter[] = [];
    for (const a of adapters.values()) {
      if (a.supports(input)) matches.push(a);
    }
    if (matches.length === 0) return undefined;
    if (matches.length > 1) {
      throw new AdapterAmbiguousError(matches.map((a) => a.id));
    }
    return matches[0];
  }

  async function parse(input: RawInput): Promise<ParseResult> {
    let picked: SourceAdapter;
    try {
      const r = resolve(input);
      if (!r) {
        return {
          ok: false,
          errorCode: "UNSUPPORTED_FORMAT",
          message: `Tidak ada adapter untuk inputKind='${input.kind}'`,
        };
      }
      picked = r;
    } catch (e) {
      if (e instanceof AdapterAmbiguousError) {
        return {
          ok: false,
          errorCode: "AMBIGUOUS",
          message: e.message,
          details: { candidateAdapters: e.matches },
        };
      }
      throw e;
    }
    const result = await picked.parse(input);
    return result;
  }

  return {
    register(adapter: SourceAdapter) {
      if (adapters.has(adapter.id)) {
        throw new AdapterAlreadyRegisteredError(adapter.id);
      }
      adapters.set(adapter.id, adapter);
    },
    unregister(adapterId: string) {
      adapters.delete(adapterId);
    },
    list() {
      return Array.from(adapters.values());
    },
    resolve,
    parse,
  };
}

/** Factory default yang membuat registry kosong. */
export function createRouterRegistry(initial: ReadonlyArray<SourceAdapter> = []): RouterRegistry {
  return buildRegistry(initial);
}
