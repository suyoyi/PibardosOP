# OPTCG API integration

Reviewed on 2026-10-15:

- [API documentation](https://optcgapi.com/documentation)
- [General information and provenance](https://optcgapi.com/about/general)

## Service scope and access

The service explicitly invites public API consumption and only accepts GET requests. It requires no authentication/key. The author asks consumers to avoid excessive calls and mentions daily limits without publishing a numeric budget or service-level guarantee. This application fetches user-requested searches/cards/collections and automatically reads the available datasets when opening Cartas, caches public JSON for one hour by default and never scrapes card websites. `429` stops a batch without retry loops. `OPTCG_CACHE_SECONDS` configures 0–86400 seconds; invalid settings fall back to 3600.

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

The builder uses `/api/allSets/` (`set_name`, `set_id`) and `/api/allDecks/` (`structure_deck_name`, `structure_deck_id`) for its named expansion selector. Automatic persistent catalog mirroring remains unused. Two-week history is requested on demand for the selected exact set/starter printing. Hybrid source collection codes such as `OP14-EB04` are retained; missing/invalid names are reported rather than invented. Documentation contains inconsistencies: the promo all-card path differs between its menu and example. On 2026-10-15 the documented `/api/allPromos/` returned 200; `/api/allPromoCards/` returned 404. The catalog uses only the verified working path. Promos two-week history is explicitly still in progress and is not called. DON has no documented history endpoint.

## Automatic catalog explorer

Authenticated **Cartas** loads `/api/allSetCards/`, `/api/allSTCards/`, `/api/allPromos/` and `/api/allDonCards/` automatically. These GET endpoints were verified live on 2026-10-15: 3654/626/1082/187 received records, approximately 2.48/0.42/0.75/0.09 MB respectively. Counts describe this check, not guaranteed complete coverage. Each streamed JSON response retains the 5 MB limit and 10000-record normalization bound. No source images are mirrored or private cards inserted by browsing.

A single public metadata snapshot per server process reuses/coalesces these reads for the configured TTL. Bulk endpoints bypass Next's per-fetch cache because the set response exceeds its entry limit; no user data enters the shared snapshot. Transport/quota failures retain prior successful categories with explicit notices, cache a partial snapshot for at most 60 seconds and stop remaining requests on network/429 without retry loops. Normalization warnings remain visible without forcing repeated loads. Server restarts/independent instances may have cold caches; this is not a persistent globally shared CDN. Cache zero disables the snapshot for ordinary browser tests.

The authenticated action runtime-validates filter/page input, reads owned/shared saved facts through RLS and combines exact printing identities with public metadata. Filtering applies to the full dataset before pagination. It returns 36 printed groups plus real filter options, not all metadata to each browser. Saved immutable facts win identity deduplication; public metadata supplies only the same printing's separate quotes/expansion name. During source failure, visible saved printings read their owned stored quote metadata under RLS. Unknown expansion names remain unavailable. Prices retain date/consultation time and unknown currency; missing and genuine zero amounts differ.

The gallery uses the builder's primary name/code, expansion, color and cost controls, with optional type/counter/power/attribute/rarity/raw-trait filters. The native modal places the large selected illustration beside details on desktop and above them on mobile. All received variants for that printed group remain selectable beyond active filters; changing art changes its exact price/details. Pagination and variant thumbnails limit rendered images. Optional explicit save uses the existing verified owned import transaction; browsing never assigns physical copies. Existing advanced import tools and saved-card detail URLs remain available.

## Selected-printing two-week price history

The documented `/api/sets/card/twoweeks/{card_set_id}/` and `/api/decks/card/twoweeks/{card_set_id}/` return arrays with normal printing identity, latest `market_price`/`inventory_price`, and `Day1_Market_Price`/`Day1_Inventory_Price` through Day13. History normalization matches the exact source family, printed code and `card_image_id`. Missing or duplicate matching identities are unavailable; another printing's series is never substituted. Promos remain documented as work in progress, and no DON history route is guessed.

**Live status on 2026-10-15:** set Usopp OP01-004, documented www-host set Zoro OP01-001, and starter ST01-003 requests each returned HTTP 500. Current catalog/quotes still work. This integration handles the failure but does not claim successful retrieval of real historical values. Ordinary tests use controlled synthetic histories.

The documentation provides no dates per DayN field and does not specify chronological direction or its relationship to `date_scraped`. The chart therefore labels Day1–Day13 in field order without invented calendar dates or percentage trends; the latest quote stays separate and appears as an additional table row. The source date is reference metadata, not a fabricated date for every point. Users see this limitation next to the chart. Missing/invalid prices stay null with line breaks and notices; actual zero stays zero. No moving average, extrapolation, missing-value interpolation, currency assumption or conversion is used.

An authenticated action validates family/printed number/exact printing identity before a bounded fixed-host GET, using the existing public JSON TTL. Opening/changing the selected art lazily requests its series; a bounded per-mounted-dialog response cache reuses public results for one minute, ignores superseded responses and supports explicit retry without automatic loops. The modal and saved-card URL share the read-only component. Recharts shows distinct solid/dashed market/inventory series and an accessible expandable raw-value table. Empty/unsupported/error states retain all card details/current quotes. Reading history does not write private cards, decks or prices; there is no new migration/dependency/secret.

## Normalization and identity

`card_set_id` is a printed number; `card_image_id` identifies artwork/printing, not the internal UUID. Provider identity includes the category and printing ID. When the image ID is missing, a deterministic local SHA-256 fingerprint uses category/set/printed code/name and the available DON display identity. This is a local fallback, not an invented provider-issued ID; source name changes require review rather than overwriting historical facts. Duplicate ambiguous identities are reported and all ambiguous rows excluded.

String numeric facts normalize strictly; JSON null, `"NULL"` and empty optional values stay null. Invalid types/colors/numbers/prices/dates are explained, not guessed. The API concatenates trait names without reliable boundaries, so the raw text remains one trait block. DON stays separate from main cards. Unexpected image hosts/paths become an explicit warning and placeholder; there is no guessed alternate-art URL.

A unique provider base printing (`card_image_id == card_set_id`) may resolve a plain code. Otherwise resolution requires one exact match. Ambiguous codes require selecting a specific catalog printing. Import review automatically resolves at most 20 missing codes and never saves a deck automatically; all unknown/malformed lines, user confirmation and raw/error audit remain authoritative.

## Direct deck-builder search

The builder uses the same search field for saved and remote cards, with a 500 ms debounce, two-character minimum and cancellation of superseded response display. The four primary controls are name/code search, named expansion, leader-compatible color and cost. Source and saved candidates share filtering. Short suffixes like `op17-99` normalize to the complete printed code. Remote previews are never inserted merely because they were searched.

`getOptcgBuilderCard` validates printed number, family and exact provider identity, authenticates, and first reuses the owner's immutable cached card. Otherwise it verifies the selected printing against the provider and uses the existing idempotent owned RPC. It returns the persisted card without redirect/revalidation, preserving draft name, notes, leader and quantities. Selecting a leader updates the leader field; selecting main/DON cards adds one copy with the appropriate role. These are virtual deck quantities and do not allocate physical inventory. Saving the deck remains an explicit separate action. Dynamic filter options retain the currently selected value during query changes, and failures leave saved candidates/editor contents available.

## Visual English-only gallery

Creation uses leader → compatible cards → name screens; editing retains the direct builder. Empty leader search uses documented `card_type=Leader` filters across set/starter/promo groups. Empty main search requests the leader's colors, and selected expansion/name/cost use documented `set_id`, `card_name`, `card_cost` and **`color`** parameters (not an invented `card_color` query parameter). A dual-color leader unions results and deduplicates exact provider identities. An expansion chooses its family; DON is a separate explicit view. Filtering again on normalized facts prevents an ignored upstream filter from offering incompatible main cards. Network/quota/server failures stop remaining group requests, retain successful candidates and never retry automatically. Main pagination shows 24 printed-code groups without extra metadata requests; images are lazy loaded. Variant dialog pagination slices known printings locally.

Live documentation and `/api/allSets/` returned named collections, including `Romance Dawn / OP-01` and `The World's Strongest Warriors / OP-17`; `/api/allDecks/` returned named starter records. A live `sets/filtered/?color=red&card_cost=2&set_id=OP-01` request returned 11 matching source records. These checks verify availability/parameter shape, not catalog completeness.

Each printing has its own virtual deck quantity and +/− controls. The selected leader is a single controlled ID and has a selection indicator; controls enforce a shared four-copy budget across canonical variants/reprints; server save validation also rejects a copy-limit violation. Main count excludes DON. The gallery shows English only, manual creation is retired and prior non-English/manual history is preserved. No language chooser or Japanese art is invented. Missing illustrations remain placeholders.

The authenticated `/api/cards/preview?url=...` route permits only the same fixed provider hosts/raster paths and bounds as owned artwork, because public search previews do not yet have private UUIDs. It reads no private card cache, writes no catalog rows, forwards no credentials and returns private no-store/nosniff image bytes. Only selecting a printing uses the owned persistence action. External hosts, ports, SVG/HTML, query/fragment/traversal and redirects are rejected. No image files are permanently stored. Ordinary browser tests intercept provider metadata and artwork without live calls.

## Grouped artwork selection

`src/domain/card-variants.ts` groups the visible candidates by normalized printed number. Known base artwork is preferred for the representative independently of canonical-root insertion order. Cached provider printings replace only the matching remote provider identity and retain their immutable historical facts; different source/printing IDs are not collapsed because an image URL is shared. Canonical-linked cards with different printed numbers remain separate gallery groups and continue to share construction limits.

Opening a group calls the authenticated `getBuilderVariants` action, which validates its printed code and consults the existing documented exact-card paths in sets/starter/promos, starting with the code's usual family. DON uses its existing single endpoint. A category's 404 is an expected empty result; network/quota/server failures stop the remaining requests while keeping successful results and actionable notices. No whole-catalog mirror or automatic retry occurs. Public JSON retains the existing cache; mounted-editor results/in-flight requests are reused to avoid duplicate queries on reopen, with explicit retry for failures.

The dialog merges known owner cards/search candidates with fetched printings for that exact code/type, then checks English/color compatibility again. Active name/expansion filters identify a gallery group but do not hide its other compatible printings in the dialog. Each variant keeps the exact UUID/provider ID and source set/printing label; only an explicitly selected printing is persisted. Closing a dialog before selection performs no catalog/deck write. The selected leader uses its exact owned artwork route both in the persistent card-step context and enlarged portrait; missing art stays a placeholder. Native modal semantics provide focus containment/Escape, focus restoration, background scroll restoration and responsive overflow control; the pending-add state prevents leaving while the requested printing is being added.

## Private persistence and historical integrity

`cards` facts are immutable to the client. `cache_optcg_card` is an authenticated, transaction-safe, idempotent RPC deriving ownership from `auth.uid()`; caller-supplied user/card IDs are ignored. It serializes printing and canonical-root creation. `optcg_card_items` holds quote/image references, source date and consultation time separately with owner SELECT-only RLS and a composite card/owner FK. Direct cache writes are denied. Canonical roots join the owner's/shared printed-number identities; alternate art does not increase copy limits.

Re-importing preserves the original name/effect/stats, UUID and snapshots, refreshing only separate quote/image metadata. Account cascade includes the new table. The migration is additive and preserves all BerryWallet facts/cache and exact deck/match references. Retired BerryWallet actions/UI and image calls have been removed; existing quotes are shown as historical without refresh.

`market_price` and `inventory_price` have **no documented currency field** in the examined responses/pages. They remain `currency: null`; catalog/raw quote UI states the uncertainty without currency symbols; the deck view uses the owner-requested USD presentation with an asterisk and explicit unverified-source denomination notice, without converting values or modifying stored currency. Missing quotes are absent, not zero. Provider `date_scraped` and consultation time are separate; alternate printings may be months older. Date-only card provenance maps to UTC midnight internally, without claiming a source update hour. Refresh reuses owner quotes younger than 15 minutes and public API responses up to the configured TTL.

Images require a valid session and an owned cache record before any network call. Only HTTPS `optcgapi.com`/`www.optcgapi.com` raster-image paths are accepted, with no credentials, ports, query, fragments, traversal or redirects. JSON and images are bounded to 5 MB while streaming. Raster MIME types are allowed, SVG/HTML rejected. Image responses use private no-store and nosniff headers; unavailable images show placeholders. Cached public JSON never contains private account/deck data.

## Verification

Public live requests returned HTTP 200 for documentation/general information, collection list, OP01-001 variants, ST01-001, P-001 promos and a filtered Zoro search. A HEAD request for the base leader artwork returned 200/image/jpeg. Real OP01-001 responses had separate base/parallel `card_image_id` values and different source dates; some promo image IDs/URLs may be absent.

Repeatable checks: `npm run check` for lint, strict types, unit/real PostgreSQL tests and build; `npm run test:e2e` for mobile authentication/import/version/match/tournament/chart/PWA and OPTCG flows. Unit fixtures are synthetic and HTTP transport injectable. Integration tests cover immutable history, idempotent cache refresh, ownership/anonymous denial, canonical variants, spoofed fields and cascading cleanup; all 14-table migrations replay in an empty disposable PostgreSQL database.

Playwright loads `tests/helpers/optcg-preload.mjs` only into its managed test server, intercepting all OPTCG traffic with synthetic records/artwork. Cache duration is zero so fixtures never enter the persistent Next.js public data cache. The standard application launchers do not load this helper and ordinary tests never depend on a live external card site. Each browser test owns a separate disposable local account. The dedicated live smoke check is reported separately in `PROJECT_STATUS.md`; it does not claim hosted Supabase, Windows execution or a Vercel deployment.

## Opponent leader selection

Match entry/edit uses the shared bounded public catalog snapshot alongside owned saved leaders. It returns one English candidate per printed code, preferring a known base artwork, with no own-leader color restriction. Grouping does not invent an unavailable base image or rewrite immutable stored facts. Only the selected remote printing calls the existing verified/idempotent owned cache transaction; merely opening/searching the list writes no cards. Native dialogs provide photo/name/code choices, full-list local search, 24-row display pagination and explicit fallback/retry. Existing historical opponent IDs stay unchanged unless deliberately replaced. Player preview always uses the exact deck-version leader rather than the current deck pointer.

## Deck valuations

The saved-deck gallery reads owner-protected stored quotes only for its exact printing UUIDs/provider IDs and weights the unique market metric by actual saved quantities. It includes leader/main/listed DON with separate subtotals and explicit quote coverage. Missing/invalid/ambiguous market quotes remain unpriced, and alternate/canonical/inventory/historical-source quotes are never substituted. Partial coverage is labeled as a subtotal rather than a complete deck value. Currency remains undeclared, and the oldest used consultation plus per-printing source date are visible. Price refresh/history use existing explicit, bounded authenticated flows; opening a deck or printing popup performs no automatic upstream metadata request or import.

### Requested USD deck display

The deck header/tiles now use a USD presentation requested by the owner. This does not change normalized quote currency from null or imply a provider-confirmed denomination/conversion. The header marks USD with an asterisk; its price-information dialog and exact-card popup explain that the source does not specify currency. A fresh bounded read of the documentation/home page still found no currency/USD declaration. Catalog/raw-provider quotes retain the existing unspecified-currency notice.
