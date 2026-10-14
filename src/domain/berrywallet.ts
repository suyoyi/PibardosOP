import { z } from "zod";
import {
  cardNumberPattern,
  normalizeCardNumber,
  type CardColor,
  type Card,
} from "./cards";

export type BerryLanguage = "en" | "jp";
export type MarketQuote = {
  market: "cardmarket" | "tcgplayer";
  currency: "EUR" | "USD";
  metric: string;
  amount: number;
};
export type BerryPreview = {
  external_id: string;
  card_number: string;
  name: string;
  variant: string;
};
export type BerryCard = BerryPreview & {
  card_type: Card["card_type"];
  colors: CardColor[];
  cost: number | null;
  power: number | null;
  counter: number | null;
  life: number | null;
  attribute: string | null;
  traits: string[];
  effect_text: string | null;
  rarity: string | null;
  language: "en" | "ja";
  set_code: string | null;
  image_path: string;
  prices: MarketQuote[];
};
export class BerryWalletError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 0,
    public readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "BerryWalletError";
  }
}
export const externalIdSchema = z.string().regex(/^op_[A-Za-z0-9_-]{1,1000}$/);
export const setCodeSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^(?:(?:OP|ST|EB-?|PRB-?)\d{2,3}|PROMO|P|-?\d{1,10})$/i);
const rawCardSchema = z
  .object({
    id: externalIdSchema,
    card_number: z
      .string()
      .transform(normalizeCardNumber)
      .refine((v) => cardNumberPattern.test(v)),
    name: z.string().trim().min(1).max(200),
    sub_type_name: z.string().max(200).nullish(),
  })
  .passthrough();
const pageSchema = z.object({
  data: z.array(z.unknown()).max(200),
  total: z.number().int().min(0),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
});
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success)
    throw new BerryWalletError(
      "INVALID_DATA",
      "BerryWallet devolvió datos con un formato inesperado. No se guardaron datos inventados.",
    );
  return r.data;
}
export function berryPreview(raw: unknown): BerryPreview {
  const card = parse(rawCardSchema, raw);
  return {
    external_id: card.id,
    card_number: card.card_number,
    name: card.name,
    variant: card.sub_type_name || "Sin variante indicada",
  };
}
function numeric(raw: unknown, max = 2147483647): number | null {
  if (raw == null || raw === "") return null;
  const value =
    typeof raw === "string" && /^\d+$/.test(raw.trim())
      ? Number(raw.trim())
      : raw;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > max
  )
    throw new BerryWalletError(
      "INVALID_DATA",
      "Un valor de coste, poder, vida o counter no es válido. Revisa la carta manualmente.",
    );
  return value;
}
export function normalizeBerryCard(
  raw: unknown,
  language: BerryLanguage,
  setCode?: string,
): BerryCard {
  const card = parse(rawCardSchema, raw),
    preview = berryPreview(card);
  const types: Record<string, Card["card_type"]> = {
    leader: "leader",
    character: "character",
    event: "event",
    stage: "stage",
    don: "don",
    "don!!": "don",
  };
  const card_type =
    typeof card.card_type === "string"
      ? types[card.card_type.toLowerCase().trim()]
      : undefined;
  if (!card_type)
    throw new BerryWalletError(
      "INCOMPLETE_CARD",
      `${preview.card_number}: el proveedor no indica un tipo de carta válido. Usa la entrada manual.`,
    );
  const colors: CardColor[] = [],
    knownColors = ["red", "green", "blue", "purple", "black", "yellow"];
  if (card.ext_color != null) {
    if (typeof card.ext_color !== "string")
      throw new BerryWalletError(
        "INVALID_DATA",
        "Los colores recibidos no son válidos.",
      );
    for (const color of card.ext_color
      .toLowerCase()
      .split(/[\s,;/|+]+/)
      .filter(Boolean)) {
      if (!knownColors.includes(color))
        throw new BerryWalletError(
          "INVALID_DATA",
          "BerryWallet incluye un color desconocido. No se asumió ningún color.",
        );
      if (!colors.includes(color as CardColor)) colors.push(color as CardColor);
    }
  }
  const text = (value: unknown, max: number): string | null =>
    value == null ? null : parse(z.string().max(max), value);
  const prices: MarketQuote[] = [];
  for (const [market, currency, metrics] of [
    ["cardmarket", "EUR", ["avg", "low", "trend", "avg1", "avg7", "avg30"]],
    [
      "tcgplayer",
      "USD",
      [
        "low_price",
        "market_price",
        "high_price",
        "mid_price",
        "direct_low_price",
      ],
    ],
  ] as const) {
    const source = card[market];
    if (source == null) continue;
    const p = parse(
      z
        .object({ prices: z.record(z.string(), z.unknown()).nullish() })
        .passthrough(),
      source,
    ).prices;
    if (!p) continue;
    for (const metric of metrics)
      if (p[metric] != null)
        prices.push({
          market,
          currency,
          metric,
          amount: parse(z.number().finite().min(0).max(1e10), p[metric]),
        });
  }
  let image_path = `/images/${preview.external_id}`;
  if (typeof card.image_url === "string") {
    try {
      const url = new URL(card.image_url);
      if (
        url.protocol === "https:" &&
        url.hostname === "api.pokewallet.io" &&
        !url.username &&
        !url.password &&
        !url.search &&
        /^\/images\/[A-Za-z0-9_-]{1,1024}$/.test(url.pathname)
      )
        image_path = url.pathname;
    } catch {
      /* Keep exact printing ID; never guess a different artwork. */
    }
  }
  return {
    ...preview,
    card_type,
    colors,
    cost: numeric(card.ext_cost, 32767),
    power: numeric(card.ext_power),
    counter: numeric(card.ext_counterplus),
    life: numeric(card.ext_life, 32767),
    attribute: text(card.ext_attribute, 200),
    traits: (text(card.ext_subtypes, 3000) ?? "")
      .split(";")
      .map((t) => t.trim())
      .filter(Boolean),
    effect_text: text(card.ext_description, 10000),
    rarity: text(card.rarity, 100),
    language: language === "jp" ? "ja" : "en",
    set_code: setCode ?? text(card.set_code, 40),
    image_path,
    prices,
  };
}
// Limit untrusted responses while streaming, before allocating the entire body.
async function boundedBody(
  response: Response,
  code: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const limit = 5_000_000;
  const reader = response.body?.getReader();
  if (!reader)
    throw new BerryWalletError(
      code,
      "El proveedor devolvió una respuesta vacía.",
    );
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit)
        throw new BerryWalletError(
          code,
          "La respuesta del proveedor supera el tamaño permitido.",
        );
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
export type BerryTransport = (
  url: string,
  init: RequestInit,
) => Promise<Response>;
export class BerryWalletClient {
  #apiKey: string;
  private remaining: number | null = null;
  constructor(
    apiKey: string,
    private readonly transport: BerryTransport = fetch,
  ) {
    this.#apiKey = apiKey;
  }
  async request(path: string, binary = false): Promise<Response> {
    if (!this.#apiKey)
      throw new BerryWalletError(
        "NOT_CONFIGURED",
        "Configura BERRYWALLET_API_KEY como secreto del servidor.",
      );
    if (
      !/^\/(?:op\/(?:sets|cards|search)|images\/)/.test(path) ||
      path.includes("..") ||
      path.includes("\\")
    )
      throw new BerryWalletError(
        "INVALID_PATH",
        "Ruta del proveedor no permitida.",
      );
    if (this.remaining === 0)
      throw new BerryWalletError(
        "RATE_LIMIT",
        "Se agotó la cuota de BerryWallet. Conservamos tu catálogo guardado.",
        429,
      );
    let response: Response;
    try {
      response = await this.transport(`https://api.pokewallet.io${path}`, {
        headers: {
          "X-API-Key": this.#apiKey,
          "User-Agent":
            "PibardosOP/0.1 (+https://github.com/suyoyi/PibardosOP)",
          Accept: binary ? "image/*" : "application/json",
        },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new BerryWalletError(
        "NETWORK",
        "No se pudo conectar con BerryWallet. Tu catálogo guardado sigue disponible.",
      );
    }
    const remaining = response.headers.get("X-RateLimit-Remaining-Hour");
    if (remaining !== null && /^\d+$/.test(remaining))
      this.remaining = Number(remaining);
    if (!response.ok) {
      await response.body?.cancel();
      const retry = Number(response.headers.get("Retry-After"));
      throw new BerryWalletError(
        response.status === 401
          ? "AUTH"
          : response.status === 429
            ? "RATE_LIMIT"
            : response.status === 404
              ? "NOT_FOUND"
              : "UPSTREAM",
        response.status === 401
          ? "BerryWallet rechazó la clave (401). Revisa su vigencia en el panel y el secreto BERRYWALLET_API_KEY."
          : response.status === 429
            ? "Límite de consultas de BerryWallet alcanzado. Inténtalo cuando se renueve la cuota."
            : response.status === 404
              ? "La carta, colección o imagen no está disponible en BerryWallet."
              : "BerryWallet no permitió completar la consulta. No se modificó tu historial.",
        response.status,
        Number.isInteger(retry) && retry > 0 ? Math.min(retry, 86400) : null,
      );
    }
    return response;
  }
  private async json(path: string): Promise<unknown> {
    const response = await this.request(path);
    try {
      const bytes = await boundedBody(response, "INVALID_DATA");
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new BerryWalletError(
        "INVALID_DATA",
        "La respuesta del proveedor no es JSON válido o supera el tamaño permitido.",
      );
    }
  }
  async search(query: string, page = 1) {
    const q = parse(z.string().trim().min(2).max(120), query);
    const result = parse(
      pageSchema,
      await this.json(
        `/op/search?q=${encodeURIComponent(q)}&limit=12&page=${parse(z.number().int().min(1).max(1000), page)}`,
      ),
    );
    return { ...result, data: result.data.map(berryPreview) };
  }
  async card(id: string, language: BerryLanguage = "en"): Promise<BerryCard> {
    const card = normalizeBerryCard(
      await this.json(`/op/cards/${parse(externalIdSchema, id)}`),
      language,
    );
    if (card.external_id !== id)
      throw new BerryWalletError(
        "ID_MISMATCH",
        "El proveedor devolvió otra impresión. No se guardó la carta.",
      );
    return card;
  }
  async set(code: string, page = 1, language: BerryLanguage = "en") {
    const response = await this.json(
      `/op/sets/${encodeURIComponent(parse(setCodeSchema, code))}?limit=200&page=${parse(z.number().int().min(1).max(1000), page)}&language=${language}`,
    );
    const metadata = parse(
      z.object({
        set: z.object({
          set_code: z.string().min(1).max(40),
          language: z.enum(["en", "jp"]),
        }),
      }),
      response,
    ).set;
    if (metadata.language !== language)
      throw new BerryWalletError(
        "LANGUAGE_MISMATCH",
        "La colección recibida no coincide con el idioma solicitado. No se etiquetaron cartas con un idioma supuesto.",
      );
    const result = parse(pageSchema, response);
    const errors: string[] = [],
      cards: BerryCard[] = [];
    for (const raw of result.data) {
      try {
        cards.push(normalizeBerryCard(raw, language, metadata.set_code));
      } catch (error) {
        errors.push(
          error instanceof BerryWalletError
            ? error.message
            : "Una carta no se pudo interpretar. Usa la entrada manual.",
        );
      }
    }
    return { ...result, data: cards, received: result.data.length, errors };
  }
  async image(path: string) {
    if (!/^\/images\/[A-Za-z0-9_-]{1,1024}$/.test(path))
      throw new BerryWalletError(
        "INVALID_PATH",
        "Identificador de imagen no válido.",
      );
    const r = await this.request(path, true);
    const type = r.headers.get("Content-Type")?.split(";")[0];
    if (
      !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
        type ?? "",
      )
    ) {
      await r.body?.cancel();
      throw new BerryWalletError(
        "INVALID_IMAGE",
        "El proveedor no devolvió una imagen válida.",
      );
    }
    const bytes = await boundedBody(r, "INVALID_IMAGE");
    const body = bytes.buffer;
    if (!body.byteLength)
      throw new BerryWalletError(
        "INVALID_IMAGE",
        "La imagen supera el tamaño permitido o está vacía.",
      );
    return { body, type: type! };
  }
}
