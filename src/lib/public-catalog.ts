import "server-only";
import { optcgClient } from "./optcg";
import type { OptcgResult } from "@/domain/optcg";

// Public metadata only. Keeping this bounded snapshot in memory also handles
// the set dataset exceeding Next's individual fetch-cache entry size limit.
// No user rows, credentials or artwork bytes ever enter this cache.
let cached:
  | {
      value: Promise<{ result: OptcgResult; fetchedAt: string }>;
      expires: number;
    }
  | undefined;
export function publicCatalog() {
  const configured = Number(process.env.OPTCG_CACHE_SECONDS ?? 3600);
  const ttl =
    Number.isInteger(configured) && configured >= 0 && configured <= 86400
      ? configured
      : 3600;
  if (ttl && cached && cached.expires > Date.now()) return cached.value;
  const entry = {
    expires: Date.now() + ttl * 1000,
    value: optcgClient()
      .catalog()
      .then((result) => {
        if (
          result.issues.some((issue) => /^(sets|decks|promos|don):/.test(issue))
        )
          entry.expires = Date.now() + Math.min(ttl, 60) * 1000;
        return { result, fetchedAt: new Date().toISOString() };
      })
      .catch((error) => {
        if (cached === entry) cached = undefined;
        throw error;
      }),
  };
  if (ttl) cached = entry;
  return entry.value;
}
