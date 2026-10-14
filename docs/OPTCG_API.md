# OPTCG API integration

Reviewed on 2026-10-14:

- [API documentation](https://optcgapi.com/documentation)
- [General information and provenance](https://optcgapi.com/about/general)

## Service scope and access

The service explicitly invites public API consumption and only accepts GET requests. It requires no authentication/key. The author asks consumers to avoid excessive calls and mentions daily limits without publishing a numeric budget or service-level guarantee. This application fetches only user-requested searches/cards/collections, caches public JSON for one hour by default and never scrapes card websites. `429` stops a batch without retry loops. `OPTCG_CACHE_SECONDS` configures 0–86400 seconds; invalid settings fall back to 3600.

General information describes English cards active on TCGPlayer and admits missing data/images, notably promos. The API supplies metadata, image references, prices and date-only provenance. A successful response does not prove complete coverage or current tournament legality. No complete current restriction dataset is installed.

The API author's invitation permits API consumption; it does not transfer franchise/third-party artwork ownership or establish permission for permanent redistribution. Artwork is referenced through a transient authenticated fixed-host proxy. No images are bundled, copied to permanent storage or added to the service-worker cache. Recheck permission before any future artwork mirror/public redistribution.

## Documented endpoints used

| Workflow             | Endpoint                                               |
| -------------------- | ------------------------------------------------------ |
| Set printed code     | `/api/sets/card/{card_set_id}/`                        |
| Starter printed code | `/api/decks/card/{card_set_id}/`                       |
| Promo/reprint code   | `/api/promos/card/{card_set_id}/`                      |
| Name search          | `/api/{sets,decks,promos,don}/filtered/?card_name=...` |
| Selected collection  | `/api/sets/{set_id}/` or `/api/decks/{set_id}/`        |
| DON code selection   | `/api/allDonCards/`                                    |

Set aliases normalize `OP01` to `OP-01` and `ST01` to `ST-01` (likewise EB/PRB). The default printed-code lookup routes ST to decks and P to promos; an explicitly selected promo group can retrieve reprints carrying OP codes. Responses are arrays, not invented pagination envelopes. Search pages in the UI slice one received result set and do not call the provider again.

The builder uses `/api/allSets/` (`set_name`, `set_id`) and `/api/allDecks/` (`structure_deck_name`, `structure_deck_id`) for its named expansion selector. All-card mirroring and two-week price history remain unused. Hybrid source collection codes such as `OP14-EB04` are retained; missing/invalid names are reported rather than invented. Documentation contains inconsistencies (for example the promo all-card path differs between its menu and example); these endpoints are intentionally not assumed working. Promos two-week history is explicitly still in progress.

## Normalization and identity

`card_set_id` is a printed number; `card_image_id` identifies artwork/printing, not the internal UUID. Provider identity includes the category and printing ID. When the image ID is missing, a deterministic local SHA-256 fingerprint uses category/set/printed code/name and the available DON display identity. This is a local fallback, not an invented provider-issued ID; source name changes require review rather than overwriting historical facts. Duplicate ambiguous identities are reported and all ambiguous rows excluded.

String numeric facts normalize strictly; JSON null, `"NULL"` and empty optional values stay null. Invalid types/colors/numbers/prices/dates are explained, not guessed. The API concatenates trait names without reliable boundaries, so the raw text remains one trait block. DON stays separate from main cards. Unexpected image hosts/paths become an explicit warning and placeholder; there is no guessed alternate-art URL.

A unique provider base printing (`card_image_id == card_set_id`) may resolve a plain code. Otherwise resolution requires one exact match. Ambiguous codes require selecting a specific catalog printing or manual entry. Import preview resolves at most 15 missing codes and never saves a deck automatically; all unknown/malformed lines, user confirmation and raw/error audit remain authoritative.

## Direct deck-builder search

The builder uses the same search field for saved and remote cards, with a 500 ms debounce, two-character minimum and cancellation of superseded response display. The four primary controls are name/code search, named expansion, leader-compatible color and cost. Source and saved candidates share filtering. Short suffixes like `op17-99` normalize to the complete printed code. Remote previews are never inserted merely because they were searched.

`getOptcgBuilderCard` validates printed number, family and exact provider identity, authenticates, and first reuses the owner's immutable cached card. Otherwise it verifies the selected printing against the provider and uses the existing idempotent owned RPC. It returns the persisted card without redirect/revalidation, preserving draft name, notes, leader and quantities. Selecting a leader updates the leader field; selecting main/DON cards adds one copy with the appropriate role. These are virtual deck quantities and do not allocate physical inventory. Saving the deck remains an explicit separate action. Dynamic filter options retain the currently selected value during query changes, and failures leave saved candidates/editor contents available.

## Visual English-only gallery

Creation uses leader → compatible cards → name screens; editing retains the direct builder. Empty leader search uses documented `card_type=Leader` filters across set/starter/promo groups. Empty main search requests the leader's colors, and selected expansion/name/cost use documented `set_id`, `card_name`, `card_cost` and **`color`** parameters (not an invented `card_color` query parameter). A dual-color leader unions results and deduplicates exact provider identities. An expansion chooses its family; DON is a separate explicit view. Filtering again on normalized facts prevents an ignored upstream filter from offering incompatible main cards. Network/quota/server failures stop remaining group requests, retain successful candidates and never retry automatically. Pagination shows 24 candidates without extra metadata requests; images are lazy loaded.

Live documentation and `/api/allSets/` returned named collections, including `Romance Dawn / OP-01` and `The World's Strongest Warriors / OP-17`; `/api/allDecks/` returned named starter records. A live `sets/filtered/?color=red&card_cost=2&set_id=OP-01` request returned 11 matching source records. These checks verify availability/parameter shape, not catalog completeness.

Each printing has its own virtual deck quantity and +/− controls. The selected leader is a single controlled ID and has a selection indicator; controls enforce a shared four-copy budget across canonical variants/reprints; server save validation also rejects a copy-limit violation. Main count excludes DON. The gallery shows English only, manual entry defaults to English and prior non-English history is preserved. No language chooser or Japanese art is invented. Missing illustrations remain placeholders.

The authenticated `/api/cards/preview?url=...` route permits only the same fixed provider hosts/raster paths and bounds as owned artwork, because public search previews do not yet have private UUIDs. It reads no private card cache, writes no catalog rows, forwards no credentials and returns private no-store/nosniff image bytes. Only selecting a printing uses the owned persistence action. External hosts, ports, SVG/HTML, query/fragment/traversal and redirects are rejected. No image files are permanently stored. Ordinary browser tests intercept provider metadata and artwork without live calls.

## Private persistence and historical integrity

`cards` facts are immutable to the client. `cache_optcg_card` is an authenticated, transaction-safe, idempotent RPC deriving ownership from `auth.uid()`; caller-supplied user/card IDs are ignored. It serializes printing and canonical-root creation. `optcg_card_items` holds quote/image references, source date and consultation time separately with owner SELECT-only RLS and a composite card/owner FK. Direct cache writes are denied. Canonical roots join the owner's/shared printed-number identities; alternate art does not increase copy limits.

Re-importing preserves the original name/effect/stats, UUID and snapshots, refreshing only separate quote/image metadata. Account cascade includes the new table. The migration is additive and preserves all BerryWallet facts/cache and exact deck/match references. Retired BerryWallet actions/UI and image calls have been removed; existing quotes are shown as historical without refresh.

`market_price` and `inventory_price` have **no documented currency field** in the examined responses/pages. They remain `currency: null`; the UI states the uncertainty and shows neither EUR/USD symbols nor conversions. Missing quotes are absent, not zero. Provider `date_scraped` and consultation time are separate; alternate printings may be months older. Date-only card provenance maps to UTC midnight internally, without claiming a source update hour. Refresh reuses owner quotes younger than 15 minutes and public API responses up to the configured TTL.

Images require a valid session and an owned cache record before any network call. Only HTTPS `optcgapi.com`/`www.optcgapi.com` raster-image paths are accepted, with no credentials, ports, query, fragments, traversal or redirects. JSON and images are bounded to 5 MB while streaming. Raster MIME types are allowed, SVG/HTML rejected. Image responses use private no-store and nosniff headers; unavailable images show placeholders. Cached public JSON never contains private account/deck data.

## Verification

Public live requests returned HTTP 200 for documentation/general information, collection list, OP01-001 variants, ST01-001, P-001 promos and a filtered Zoro search. A HEAD request for the base leader artwork returned 200/image/jpeg. Real OP01-001 responses had separate base/parallel `card_image_id` values and different source dates; some promo image IDs/URLs may be absent.

Repeatable checks: `npm run check` for lint, strict types, unit/real PostgreSQL tests and build; `npm run test:e2e` for mobile authentication/import/version/match/tournament/chart/PWA and OPTCG flows. Unit fixtures are synthetic and HTTP transport injectable. Integration tests cover immutable history, idempotent cache refresh, ownership/anonymous denial, canonical variants, spoofed fields and cascading cleanup; all 13-table migrations replay in an empty disposable PostgreSQL database.

Playwright loads `tests/helpers/optcg-preload.mjs` only into its managed test server, intercepting all OPTCG traffic with synthetic records/artwork. Cache duration is zero so fixtures never enter the persistent Next.js public data cache. The standard application launchers do not load this helper and ordinary tests never depend on a live external card site. Each browser test owns a separate disposable local account. The dedicated live smoke check is reported separately in `PROJECT_STATUS.md`; it does not claim hosted Supabase, Windows execution or a Vercel deployment.
