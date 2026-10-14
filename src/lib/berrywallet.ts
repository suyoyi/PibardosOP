import "server-only";
import { EnvHttpProxyAgent, type Dispatcher } from "undici";
import {
  BerryWalletClient,
  BerryWalletError,
  type BerryLanguage,
} from "@/domain/berrywallet";
import {
  filterCards,
  type CardProvider,
  type CardFilters,
} from "@/domain/cards";
import type { AppClient } from "./data";
import { getCatalog } from "./data";
let dispatcher: Dispatcher | undefined;
export function berryConfigured() {
  return Boolean(process.env.BERRYWALLET_API_KEY);
}
export function berryClient() {
  if (
    !dispatcher &&
    (process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY ||
      process.env.https_proxy ||
      process.env.http_proxy)
  )
    dispatcher = new EnvHttpProxyAgent();
  return new BerryWalletClient(
    process.env.BERRYWALLET_API_KEY ?? "",
    (url, init) => {
      const options: RequestInit & { dispatcher?: Dispatcher } = {
        ...init,
        dispatcher,
      };
      return fetch(url, options);
    },
  );
}
export class BerryWalletProvider implements CardProvider {
  constructor(
    private readonly db: AppClient,
    private readonly language: BerryLanguage = "en",
    private readonly setCode?: string,
    private readonly api = berryClient(),
  ) {}
  async search(filters: CardFilters) {
    return filterCards(
      (await getCatalog(this.db)).filter((c) => c.source === "berrywallet"),
      filters,
    );
  }
  async getCard(id: string) {
    const { data, error } = await this.db
      .from("cards")
      .select("*")
      .eq("id", id)
      .eq("source", "berrywallet")
      .maybeSingle();
    if (error) throw new Error("No se pudo consultar la carta guardada.");
    return data;
  }
  async importCard(id: string) {
    const card = await this.api.card(id, this.language);
    return this.save(card);
  }
  private async save(card: Awaited<ReturnType<BerryWalletClient["card"]>>) {
    const { data, error } = await this.db.rpc("cache_berrywallet_card", {
      p_card: card,
    });
    if (error)
      throw new BerryWalletError(
        "PERSISTENCE",
        "No se pudo guardar la carta del proveedor. Comprueba las migraciones y la conexión.",
      );
    return data;
  }
  async synchronize() {
    if (!this.setCode)
      throw new BerryWalletError(
        "SET_REQUIRED",
        "Selecciona una colección para sincronizar.",
      );
    let imported = 0,
      page = 1,
      received = 0,
      total = 0;
    const errors: string[] = [];
    do {
      const result = await this.api.set(this.setCode, page, this.language);
      total = result.total;
      received += result.received;
      errors.push(...result.errors);
      for (const card of result.data) {
        await this.save(card);
        imported++;
      }
      if (result.received === 0 && received < total)
        throw new BerryWalletError(
          "INCOMPLETE_PAGE",
          "El proveedor devolvió una página vacía antes de terminar. Las cartas recibidas siguen guardadas.",
        );
      page++;
      if (page > 25 && received < total)
        throw new BerryWalletError(
          "SET_LIMIT",
          "La colección supera el límite de esta sincronización. No se asumió que estuviera completa.",
        );
    } while (received < total);
    return {
      mode: "dataset" as const,
      imported,
      message: `${imported} fichas consultadas y guardadas. ${errors.length ? `${errors.length} entradas incompletas: ${errors.slice(0, 5).join(" ")}` : "Datos del proveedor, sin certificación de legalidad de torneo."}`,
    };
  }
}
