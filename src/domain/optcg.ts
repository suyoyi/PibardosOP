import { createHash } from "node:crypto";
import { z } from "zod";
import {
  cardNumberPattern,
  normalizeCardNumber,
  normalizeCardSearch,
  type Card,
  type CardColor,
} from "./cards";
export type OptcgFamily = "sets" | "decks" | "promos" | "don";
export const familySchema = z.enum(["sets", "decks", "promos", "don"]);
export const optcgIdSchema = z
  .string()
  .regex(/^optcg_(?:sets|decks|promos|don)_[A-Za-z0-9_-]{1,200}$/);
export const optcgSetSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^(?:OP|ST|EB|PRB)-?\d{2,3}(?:-EB-?\d{2,3})?$/);
export type OptcgExpansion = {
  id: string;
  name: string;
  family: "sets" | "decks";
};
export type OptcgQuote = {
  metric: "market_price" | "inventory_price";
  amount: number;
  currency: null;
};
export type OptcgCard = {
  external_id: string;
  family: OptcgFamily;
  card_number: string;
  name: string;
  variant: string;
  card_type: Card["card_type"];
  colors: CardColor[];
  cost: number | null;
  power: number | null;
  counter: number | null;
  life: number | null;
  attribute: string | null;
  traits: string[];
  effect_text: string | null;
  set_code: string | null;
  rarity: string | null;
  language: "en";
  image_url: string | null;
  source_date: string | null;
  prices: OptcgQuote[];
  is_base: boolean;
  warnings: string[];
};
export class OptcgError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 0,
  ) {
    super(message);
    this.name = "OptcgError";
  }
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success)
    throw new OptcgError(
      "INVALID_DATA",
      "OPTCG API devolvió datos no válidos. No se inventaron datos de cartas.",
    );
  return r.data;
}
function text(value: unknown, max: number): string | null {
  if (value == null || value === "NULL" || value === "") return null;
  return parse(z.string().trim().max(max), value);
}
function numeric(value: unknown, max = 2147483647): number | null {
  if (value == null || value === "NULL" || value === "") return null;
  const n =
    typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : value;
  return parse(z.number().int().min(0).max(max), n);
}
export function safeOptcgImage(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      !["optcgapi.com", "www.optcgapi.com"].includes(u.hostname) ||
      u.username ||
      u.password ||
      u.port ||
      u.search ||
      u.hash ||
      !/^\/media\/static\/Card_Images\/[A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp|avif)$/.test(
        u.pathname,
      ) ||
      u.pathname.includes("..")
    )
      return null;
    return u.toString();
  } catch {
    return null;
  }
}
export function normalizeOptcgCard(
  raw: unknown,
  family: OptcgFamily,
): OptcgCard {
  const r = parse(z.record(z.string(), z.unknown()), raw),
    name = parse(z.string().trim().min(1).max(200), r.card_name);
  const types: Record<string, Card["card_type"]> = {
    leader: "leader",
    character: "character",
    event: "event",
    stage: "stage",
    "don!!": "don",
    don: "don",
  };
  const card_type =
    typeof r.card_type === "string"
      ? types[r.card_type.toLowerCase().trim()]
      : undefined;
  if (!card_type)
    throw new OptcgError(
      "INCOMPLETE_CARD",
      `${name}: falta un tipo de carta válido. Usa la entrada manual.`,
    );
  const card_number =
    card_type === "don"
      ? "DON!!"
      : parse(
          z
            .string()
            .transform(normalizeCardNumber)
            .refine((n) => cardNumberPattern.test(n)),
          r.card_set_id,
        );
  const colors: CardColor[] = [];
  const color = text(r.card_color, 100);
  if (color)
    for (const value of color
      .toLowerCase()
      .split(/[\s,;/|+]+/)
      .filter(Boolean)) {
      const c = parse(
        z.enum(["red", "green", "blue", "purple", "black", "yellow"]),
        value,
      );
      if (!colors.includes(c)) colors.push(c);
    }
  const printing = text(r.card_image_id, 200),
    set_code = text(r.set_id, 40);
  if (printing && !/^[A-Za-z0-9_-]+$/.test(printing))
    throw new OptcgError(
      "INVALID_ID",
      `${card_number}: identificador de impresión no válido.`,
    );
  // Missing provider IDs get a conservative, deterministic local identity from
  // provenance and display identity, never price/effect fields that may change.
  const identity =
    printing ??
    `f_${createHash("sha256")
      .update(
        JSON.stringify([
          family,
          set_code,
          card_number,
          name,
          text(r.optcg_don_name, 300),
        ]),
      )
      .digest("hex")}`;
  const image_url = safeOptcgImage(r.card_image),
    warnings: string[] = [];
  if (r.card_image != null && !image_url)
    warnings.push(
      `${card_number}: enlace de imagen no permitido; se muestra un marcador.`,
    );
  const source_date =
    r.date_scraped == null ? null : parse(z.iso.date(), r.date_scraped);
  const prices: OptcgQuote[] = [];
  for (const metric of ["market_price", "inventory_price"] as const) {
    if (r[metric] != null && r[metric] !== "NULL")
      prices.push({
        metric,
        amount: parse(z.number().finite().nonnegative().max(1e10), r[metric]),
        currency: null,
      });
  }
  return {
    external_id: `optcg_${family}_${identity}`,
    family,
    card_number,
    name,
    variant: printing ?? name,
    card_type,
    colors,
    cost: numeric(r.card_cost, 32767),
    power: numeric(r.card_power),
    counter: numeric(r.counter_amount),
    life: numeric(r.life, 32767),
    attribute: text(r.attribute, 200),
    traits: text(r.sub_types, 3000) ? [text(r.sub_types, 3000)!] : [],
    effect_text: text(r.card_text, 10000),
    set_code,
    rarity: text(r.rarity, 100),
    language: "en",
    image_url,
    source_date,
    prices,
    is_base: printing === card_number,
    warnings,
  };
}
export type OptcgResult = {
  cards: OptcgCard[];
  issues: string[];
  received: number;
};
export function normalizeOptcgRecords(
  raw: unknown,
  family: OptcgFamily,
): OptcgResult {
  const records = parse(z.array(z.unknown()).max(10000), raw),
    cards: OptcgCard[] = [],
    issues: string[] = [];
  const seen = new Set<string>(),
    ambiguous = new Set<string>();
  for (const [index, value] of records.entries())
    try {
      const card = normalizeOptcgCard(value, family);
      if (seen.has(card.external_id)) {
        ambiguous.add(card.external_id);
        issues.push(
          `Entrada ${index + 1}: identidad de impresión duplicada. Revisa la variante manualmente.`,
        );
        continue;
      }
      seen.add(card.external_id);
      cards.push(card);
      issues.push(...card.warnings);
    } catch (e) {
      issues.push(
        `Entrada ${index + 1}: ${e instanceof OptcgError ? e.message : "No se pudo interpretar; usa la entrada manual."}`,
      );
    }
  return {
    cards: cards.filter((c) => !ambiguous.has(c.external_id)),
    issues,
    received: records.length,
  };
}
export function selectDefaultOptcgPrinting(
  cards: OptcgCard[],
  number: string,
): OptcgCard | null {
  const exact = cards.filter((c) => c.card_number === number),
    base = exact.filter((c) => c.is_base);
  return base.length === 1 ? base[0] : exact.length === 1 ? exact[0] : null;
}
export type OptcgTransport = (
  url: string,
  init: RequestInit,
) => Promise<Response>;
async function body(response: Response): Promise<Uint8Array<ArrayBuffer>> {
  const reader = response.body?.getReader();
  if (!reader) throw new OptcgError("EMPTY", "Respuesta vacía del proveedor.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const p = await reader.read();
      if (p.done) break;
      size += p.value.byteLength;
      if (size > 5_000_000)
        throw new OptcgError(
          "SIZE_LIMIT",
          "La respuesta del proveedor supera el tamaño permitido.",
        );
      chunks.push(p.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    output.set(c, offset);
    offset += c.byteLength;
  }
  return output;
}
export class OptcgClient {
  constructor(private readonly transport: OptcgTransport = fetch) {}
  private async request(url: string, binary = false): Promise<Response> {
    const u = new URL(url);
    if (
      binary
        ? !safeOptcgImage(url)
        : u.origin !== "https://optcgapi.com" ||
          !u.pathname.startsWith("/api/") ||
          u.pathname.includes("..")
    )
      throw new OptcgError("INVALID_PATH", "Ruta del proveedor no permitida.");
    let response: Response;
    try {
      response = await this.transport(url, {
        method: "GET",
        headers: {
          Accept: binary ? "image/*" : "application/json",
          "User-Agent":
            "PibardosOP/0.1 (+https://github.com/suyoyi/PibardosOP)",
        },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new OptcgError(
        "NETWORK",
        "No se pudo conectar con OPTCG API. Tu catálogo guardado sigue disponible.",
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new OptcgError(
        response.status === 429
          ? "RATE_LIMIT"
          : response.status === 404
            ? "NOT_FOUND"
            : "UPSTREAM",
        response.status === 429
          ? "OPTCG API ha limitado las consultas. Inténtalo más tarde; no reintentamos automáticamente."
          : response.status === 404
            ? "La carta o colección no está disponible. Corrige el código o añádela manualmente."
            : "OPTCG API no permitió completar la consulta. Tu historial se conserva.",
        response.status,
      );
    }
    return response;
  }
  private async records(path: string, family: OptcgFamily) {
    const response = await this.request(`https://optcgapi.com${path}`);
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder().decode(await body(response)));
    } catch {
      throw new OptcgError(
        "INVALID_DATA",
        "La respuesta del proveedor no es JSON válido o supera el tamaño permitido.",
      );
    }
    return normalizeOptcgRecords(raw, family);
  }
  async cards(number: string, family?: OptcgFamily) {
    const code = parse(
      z
        .string()
        .transform(normalizeCardNumber)
        .refine((n) => cardNumberPattern.test(n)),
      number,
    );
    const group =
      family ??
      (code.startsWith("ST")
        ? "decks"
        : code.startsWith("P-")
          ? "promos"
          : code === "DON!!"
            ? "don"
            : "sets");
    if (group === "don") return this.records("/api/allDonCards/", group);
    return this.records(
      `/api/${group}/card/${encodeURIComponent(code)}/`,
      group,
    );
  }
  async variants(number: string): Promise<OptcgResult> {
    const code = parse(
      z
        .string()
        .transform(normalizeCardNumber)
        .refine((value) => cardNumberPattern.test(value)),
      number,
    );
    if (code === "DON!!") return this.cards(code, "don");
    const first = code.startsWith("ST")
      ? "decks"
      : code.startsWith("P-")
        ? "promos"
        : "sets";
    const families = [
      first,
      ...(["sets", "decks", "promos"] as const).filter(
        (family) => family !== first,
      ),
    ] as Exclude<OptcgFamily, "don">[];
    const cards: OptcgCard[] = [],
      issues: string[] = [];
    let received = 0;
    for (const family of families) {
      try {
        const response = await this.cards(code, family);
        cards.push(
          ...response.cards.filter((card) => card.card_number === code),
        );
        issues.push(...response.issues);
        received += response.received;
      } catch (error) {
        // A category without this printed number is an expected empty result.
        if (error instanceof OptcgError && error.status === 404) continue;
        issues.push(
          `${family}: ${error instanceof OptcgError ? error.message : "No se pudieron consultar las variantes."}`,
        );
        if (
          !(error instanceof OptcgError) ||
          ["NETWORK", "RATE_LIMIT"].includes(error.code) ||
          error.status >= 500
        )
          break;
      }
    }
    return {
      cards: [
        ...new Map(cards.map((card) => [card.external_id, card])).values(),
      ],
      issues,
      received,
    };
  }
  async search(query: string, family: OptcgFamily = "sets") {
    const q = normalizeCardSearch(
      parse(z.string().trim().min(2).max(120), query),
    );
    if (cardNumberPattern.test(normalizeCardNumber(q)))
      return this.cards(q, family === "sets" ? undefined : family);
    return this.records(
      `/api/${family}/filtered/?card_name=${encodeURIComponent(q)}`,
      family,
    );
  }
  async expansions() {
    const rows: OptcgExpansion[] = [];
    const issues: string[] = [];
    for (const family of ["sets", "decks"] as const) {
      try {
        const response = await this.request(
          `https://optcgapi.com/api/${family === "sets" ? "allSets" : "allDecks"}/`,
        );
        const values = parse(
          z.array(z.record(z.string(), z.unknown())).max(500),
          JSON.parse(new TextDecoder().decode(await body(response))),
        );
        for (const value of values) {
          try {
            const id = parse(
              optcgSetSchema,
              value[family === "sets" ? "set_id" : "structure_deck_id"],
            );
            const name = parse(
              z.string().trim().min(1).max(200),
              value[family === "sets" ? "set_name" : "structure_deck_name"],
            );
            if (!rows.some((row) => row.id === id))
              rows.push({ id, name, family });
          } catch {
            issues.push(
              "Una expansión recibida no tiene un código o nombre válido.",
            );
          }
        }
      } catch (error) {
        issues.push(
          family === "sets"
            ? "No se pudieron cargar los nombres de expansiones. Puedes seguir buscando cartas."
            : "No se pudieron cargar los nombres de mazos iniciales.",
        );
        if (
          error instanceof OptcgError &&
          ["NETWORK", "RATE_LIMIT"].includes(error.code)
        )
          break;
      }
    }
    return { expansions: rows, issues };
  }
  async filtered(
    family: Exclude<OptcgFamily, "don">,
    filters: {
      search?: string;
      set?: string;
      color?: string;
      cost?: string;
      leader?: boolean;
    },
  ) {
    const params = new URLSearchParams();
    if (filters.search)
      params.set(
        "card_name",
        parse(z.string().trim().max(120), filters.search),
      );
    if (filters.set) params.set("set_id", parse(optcgSetSchema, filters.set));
    if (filters.color)
      params.set(
        "color",
        parse(
          z.enum(["red", "green", "blue", "purple", "black", "yellow"]),
          filters.color,
        ),
      );
    if (filters.cost)
      params.set(
        "card_cost",
        parse(z.string().regex(/^\d{1,3}$/), filters.cost),
      );
    if (filters.leader) params.set("card_type", "Leader");
    return this.records(`/api/${family}/filtered/?${params}`, family);
  }
  async leaders(family: OptcgFamily = "sets") {
    if (family === "don") return { cards: [], issues: [], received: 0 };
    return this.records(`/api/${family}/filtered/?card_type=Leader`, family);
  }
  async promoCollection(code: string) {
    const set = parse(optcgSetSchema, code).replaceAll("-", "");
    return this.records(`/api/promos/filtered/?set_id=${set}`, "promos");
  }
  async set(code: string) {
    const normalized = parse(optcgSetSchema, code).replace(
        /^(OP|ST|EB|PRB)-?(\d+)$/,
        "$1-$2",
      ),
      family = normalized.startsWith("ST-") ? "decks" : "sets";
    return this.records(`/api/${family}/${normalized}/`, family);
  }
  async image(url: string) {
    const response = await this.request(url, true),
      type = response.headers.get("Content-Type")?.split(";")[0];
    if (
      !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
        type ?? "",
      )
    ) {
      await response.body?.cancel();
      throw new OptcgError(
        "INVALID_IMAGE",
        "El proveedor no devolvió una imagen permitida.",
      );
    }
    const bytes = await body(response);
    if (!bytes.byteLength)
      throw new OptcgError("INVALID_IMAGE", "Imagen vacía.");
    return { body: bytes.buffer, type: type! };
  }
}
