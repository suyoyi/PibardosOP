import "server-only";
import { EnvHttpProxyAgent, type Dispatcher } from "undici";
import {
  OptcgClient,
  OptcgError,
  type OptcgCard,
  type OptcgFamily,
} from "@/domain/optcg";
import {
  normalizeCardNumber,
  filterCards,
  type CardProvider,
  type CardFilters,
} from "@/domain/cards";
import { getCatalog, type AppClient } from "./data";
let dispatcher: Dispatcher | undefined;
export function optcgClient() {
  if (
    !dispatcher &&
    (process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY ||
      process.env.https_proxy ||
      process.env.http_proxy)
  )
    dispatcher = new EnvHttpProxyAgent();
  const configured = Number(process.env.OPTCG_CACHE_SECONDS ?? 3600),
    ttl =
      Number.isInteger(configured) && configured >= 0 && configured <= 86400
        ? configured
        : 3600;
  return new OptcgClient((url, init) => {
    const metadata = new URL(url).pathname.startsWith("/api/");
    const options: RequestInit & {
      dispatcher?: Dispatcher;
    } = {
      ...init,
      dispatcher,
      ...(metadata &&
      ttl > 0 &&
      !/\/api\/all(?:SetCards|STCards|Promos|DonCards)\//.test(
        new URL(url).pathname,
      )
        ? { cache: "force-cache", next: { revalidate: ttl } }
        : {}),
    };
    return fetch(url, options);
  });
}
export class OptcgProvider implements CardProvider {
  constructor(
    private readonly db: AppClient,
    private readonly setCode?: string,
    private readonly api = optcgClient(),
  ) {}
  async search(filters: CardFilters) {
    return filterCards(
      (await getCatalog(this.db)).filter((c) => c.source === "optcgapi"),
      filters,
    );
  }
  async getCard(id: string) {
    const { data, error } = await this.db
      .from("cards")
      .select("*")
      .eq("id", id)
      .eq("source", "optcgapi")
      .maybeSingle();
    if (error)
      throw new OptcgError("PERSISTENCE", "No se pudo leer la carta guardada.");
    return data;
  }
  async save(card: OptcgCard) {
    const { data, error } = await this.db.rpc("cache_optcg_card", {
      p_card: card,
    });
    if (error)
      throw new OptcgError(
        "PERSISTENCE",
        "No se pudo guardar la carta. Revisa la conexión y las migraciones.",
      );
    return data;
  }
  async importCard(number: string, id: string, family: OptcgFamily) {
    const result = await this.api.cards(number, family),
      card = result.cards.find(
        (c) =>
          c.external_id === id && c.card_number === normalizeCardNumber(number),
      );
    if (!card)
      throw new OptcgError(
        "PRINTING_NOT_FOUND",
        "La impresión seleccionada ya no está disponible o sus datos están incompletos. Revisa el catálogo o revisa el código o vuelve a consultar el proveedor.",
      );
    return this.save(card);
  }
  async synchronize() {
    if (!this.setCode)
      throw new OptcgError("SET_REQUIRED", "Selecciona una colección.");
    const result = await this.api.set(this.setCode);
    let imported = 0;
    for (const card of result.cards) {
      await this.save(card);
      imported++;
    }
    return {
      mode: "dataset" as const,
      imported,
      message: `${imported} fichas consultadas y guardadas. ${result.issues.length ? `Avisos (${result.issues.length}): ${result.issues.join(" ")}` : "Datos del proveedor, sin certificación de legalidad de torneo."}`,
    };
  }
}
