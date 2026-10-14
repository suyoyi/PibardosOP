# Project status

## Phase 0 — complete

- Inspected the empty repository and toolchain; no existing files were overwritten.
- Architecture, data flow, schema, delivery phases, acceptance criteria and external risks recorded in `docs/ARCHITECTURE.md`.
- Decision: implement phase 1 first with an empty catalog and real Supabase authentication; no fabricated card data.

## Phase 1 — foundation complete (local development)

Implemented:

- Next.js App Router, strict TypeScript, React, Tailwind, original dark tokens and reusable UI.
- Spanish responsive shell, fixed mobile navigation, loading/empty/error states and real read-only dashboard/catalog/deck/match/statistics queries.
- Supabase SSR password signup/sign-in/sign-out, validated inputs, safe return paths, server-side route protection and private no-store responses.
- Versioned PostgreSQL migration for all proposed entities, RLS on 11 tables, nested ownership foreign keys, immutable version writes through a transactional RPC, printing/canonical identities and exclusive inventory allocation guards.
- Generated database TypeScript contract, environment placeholders, repeatable scripts and CI definition.
- PWA manifest, original PNG icons and a conservative service worker with an offline notice that caches no private responses.

Executed validation on 2026-10-13:

- `npm ci --cache /workspace/.npm-cache`: passed; lockfile installation reproduced.
- `npm run check`: passed (lint with zero warnings, strict types, **25 tests** across three files, production build).
- Unit tests: **15 passed** (auth validation/redirect safety and honest win-rate/sample-count conventions).
- PostgreSQL integration tests: **10 passed** against real local Supabase/PostgreSQL (RLS, anonymous denial, forged/cross-owner links, immutable history, transactional rollback, version membership, reprints, physical inventory and event archival/round consistency).
- Mobile Playwright suite: **3 passed**, covering wrong credentials, signup/sign-in/sign-out and protected navigation, zero-data views without overflow, manifest/icon responses, active service worker and offline fallback without private cache entries.
- Migrations applied on fresh local startup; public connection settings generated without a service-role key.
- Local services were stopped and restarted; mandatory PostgreSQL/Auth/REST readiness checks passed, a committed synthetic marker survived, and all restart fixtures were removed afterward.
- The critical mobile authentication/navigation flow passed again after restart. Next.js-generated agent guidance is committed; generated type declarations are ignored and regenerated before standalone type checking.
- Installation and startup instructions saved to cloud configuration draft. Draft persistence is confirmed; environment publication and restoration in a new task are not claimed.

Diagnosed environment limitations:

- Standard PostgreSQL Docker image exceeded daemon storage; official digest-pinned reduced images work.
- Injected proxy breaks BusyBox's local Auth health probe (403). A direct probe without the proxy and gateway Auth health succeed. The opt-in `PIBARDOS_HTTP_READINESS=true` uses mandatory real service checks instead; Docker still labels its own Auth probe unhealthy. Functional authentication passed in the browser.
- Playwright CDN is blocked by the original cloud network policy; installed Chromium is used successfully. No custom network additions are needed for this setup.

Product limitations at phase 1 completion (later sections supersede implemented features):

- Foundation screens read real data but deck creation/import/editing, full version comparison UI, match/tournament entry, detailed analytics, simulator and collection UI are subsequent phases. No disabled action pretends to implement them.
- Catalog intentionally empty; no external provider, artwork or current restriction data is asserted verified.
- Production Supabase account/configuration, email delivery and hosted deployment are still pending. Local email confirmation is disabled for development only.
- Account recovery/export/deletion and offline read/write synchronization remain release gates; no full MVP, production deployment or offline synchronization is claimed.

## Next phases

Phases 2–4 are implemented below. Next: phase 5 practice simulation, then phase 6 collection and explicitly designed offline behavior. Account recovery/export/deletion and hosted production configuration remain release gates. Full MVP and production deployment are not complete.

## Phases 2 and 3 — cards, import and deck management complete locally

- Added provider-agnostic `CardProvider` and a documented manual-catalog adapter. No external dataset/license/API is assumed. User-supplied cards are private, immutable and explicitly unverified; shared catalog rows remain read-only. Manual artwork is not downloaded or stored.
- Catalog search/detail and color, type, set, cost, power, counter and attribute filters; artwork placeholders and compact/grid views.
- Extensible decklist syntax handlers, Unicode/code/newline normalization, recognized/unknown/malformed/duplicate preview, explicit confirmation, raw-input audit history and text export/download. Unknown lines block saving until corrected; browser CRLF is normalized to the same audited text.
- Create, rename, edit leader/quantities/metadata, duplicate, archive/restore and delete unreferenced decks. Incomplete construction can be saved explicitly as a draft; active decks require valid construction.
- Independent domain validation covers main/leader/type/color/canonical printing limits, separate DON and effective dated restrictions. Full tournament legality stays unverified without a verified complete restriction dataset.
- Atomic save RPC creates metadata/snapshot/import confirmation together, avoids redundant list versions and rejects stale-version edits. Existing match/tournament references prevent destructive deck deletion. Version history/comparison includes leader, format, quantity changes and cost curves.
- Executed production build, strict types and lint. Real PostgreSQL tests exercised private card isolation, forged references, rollback, version preservation, no-op metadata edits, independent duplication/deletion and stale edits. A mobile Chromium flow passed for manual card creation, unknown correction, duplicate aggregation, confirmation, export, editing, comparison and duplication.
- Catalog/restriction sources are still manual/unverified. Printed-code text export cannot retain alternate-art selection; database snapshots retain exact printing IDs. Production deployment remains pending.

## Phase 4 — competitive tracking complete locally

- Fast match entry records exact deck version, opponent leader, win/loss/draw and first/second, with optional timestamp, opponent name, type, event and notes. History supports filters, pagination, corrections and confirmed deletion.
- Tournament create/edit, exact version selection, manual placement, numbered round recording, summary, archive/restore and retained history. Atomic match/round RPC rolls back conflicts and prevents retry duplicates. Database guards freeze event version/format after games exist and block cross-owner/card/version links. Archived events permit corrections of existing games but no new rounds.
- Recharts show persisted results by deck, exact version, opponent leader, play order and Madrid calendar month; accessible data tables expose every percentage's denominator. Draws are excluded; zero decisive games show no percentage. A five-game context threshold flags small samples rather than implying statistical significance. Deck/format filters apply to all summaries and graphs.
- Builder uses React Hook Form for structured values, independent domain validation and server Zod validation. Manual/shared roots with the same printed code and canonical-linked reprints share copy limits. Unknown colors do not produce a verified construction claim. Every import preview retains a separate raw/error audit, including unknown entries later corrected.
- Final executed verification: `npm run check` passed lint with zero warnings, strict types, **71 unit/PostgreSQL integration tests across 9 files**, and production build. All **6 mobile Chromium E2E tests** passed: CSRF/auth/PWA regressions, manual catalog/import/versions/duplication, and fifty-card active import → exact-version games → tournament rounds/corrections → archive → sample-aware charts → confirmed deletion with recomputed results.
- All application SQL migrations replayed successfully in a new disposable PostgreSQL database with minimal Supabase Auth fixtures. The replay exercised card/deck/match writes, structured snapshot summaries and account-data cascading removal. Separate integration and browser tests used the real local Supabase services; test accounts and temporary databases were cleaned up.
- Startup now restores locked dependencies when their fingerprint changes and applies pending local migrations without reset. Updated Windows-compatible local launcher was exercised on Linux with browser opening disabled: frozen reinstall, PostgreSQL/Auth/REST verification, migration replay, production build and actual health/login responses succeeded. Windows execution, hosted deployment and new Codespaces provisioning remain unverified.
- Remaining product limitations: no licensed external card dataset or verified complete current restrictions, no bundled franchise artwork, no practice simulator/collection UI/offline writes yet, and account recovery/export/deletion UI still pending. Manual card facts remain private and immutable. Match entry uses explicit UTC; history and monthly graphs use Madrid time. No full MVP or production deployment is claimed.

## Browser access — Codespaces preparation

- Added a pinned Node 24 devcontainer with official Docker-in-Docker, automatic install/start hooks and only port 3000 forwarded. Other database/API ports are not auto-forwarded.
- Added `preview:start`: starts and verifies local Supabase, preserves configuration, builds a production preview, checks the actual login form and app health, and avoids duplicate app processes. This enables the existing PWA worker without publishing the application.
- Configured exact-host Codespaces origin allowances for Next.js assets and Server Actions, preserving default protection elsewhere.
- Official image/feature source metadata was checked; the Docker feature registry manifest is available. This cloud's network policy blocks the MCR data redirect, so a complete devcontainer image build was not performed here. GitHub Codespaces provisioning is not claimed verified.
- Updated browser-access instructions and the launch link. The user must create the Codespace using their own GitHub account; this chat has no Codespaces-creation tool.
- Executed validation: devcontainer CLI accepted the configuration; launcher syntax and formatting checks passed; lint and strict types passed; **30 unit/integration tests** passed, including five exact-origin configuration tests.
- The preview launcher started local Supabase and a production app, verified real health/login responses, and reused the healthy server on a second invocation.
- **4 mobile E2E tests passed** with Codespaces origin metadata, including native HTTP replay of a real Server Action: an untrusted Origin was rejected before account creation; the exact allowed Codespace Origin created an account whose session opened the private dashboard. Dedicated accounts were removed afterward.

## Windows local startup — preparation

- Added `local:start` with dependency bootstrap, verified Supabase, preserved public configuration, a foreground loopback app and readiness-gated browser opening. Local data is never reset on launch or exit.
- Supabase now runs through its published JavaScript CLI entry point using Node, avoiding Windows-incompatible execution of a Unix npm shim. The local launcher similarly invokes npm's JavaScript entry and Next.js directly.
- Windows browser opening uses the default handler through PowerShell; macOS/Linux openers are also supported. Instructions cover opening the repository in a local desktop-agent session.
- No Windows computer is attached to this chat. Execution on the owner's Windows PC and actual browser opening there are not claimed verified.
- Executed Linux validation: pinned dependency installation, Supabase CLI version, lint, strict types and all 30 unit/integration tests passed. The new launcher started verified PostgreSQL/Auth/REST, built the application and checked real health/login responses with browser opening disabled. Sending SIGINT to the launcher stopped its web server while retaining Supabase containers; browser opening on Windows remains untested.

## BerryWallet — adapter implemented; live authentication blocked

- Added a server-only BerryWallet adapter implementing `CardProvider`, strict documented-response normalization, explicit remote search/add and selected-collection loading with full-total pagination. No scraping, full-catalog mirroring, paid price endpoints, trials or purchases. Public documentation, quota and terms review is recorded in `docs/BERRYWALLET.md`.
- Import preview optionally resolves up to 15 unknown codes with explicit user action; ambiguous printings require catalog selection. The preview retains unknown/malformed lines and raw text, saves provider notices in its independent audit and still requires confirmation before deck persistence. Ordinary previews never depend on the external API.
- Additive migration separates opaque provider printing IDs from internal UUIDs/printed numbers and stores private quote/image references behind owner RLS and a composite ownership FK. An authenticated idempotent transaction derives ownership from `auth.uid()`, serializes canonical identity and never overwrites historical card facts. Only separate quote/image metadata refreshes. Account cascading deletion includes this cache.
- Card detail shows cached CardMarket EUR and TCGPlayer USD amounts, consultation timestamp and 15-minute quote reuse; missing amounts are not zero. Authenticated artwork is fetched through the fixed-host server route with path/MIME/streaming size bounds, no redirects, no shared cache and no permanent image storage. Missing artwork falls back safely. Exact opaque-ID artwork support remains unverified live.
- Added isolated network-proxy transport for this cloud's secret bindings without changing local Supabase requests. Credentials remain server-only. The current saved binding is present and its domain allowance is correct. Public provider health returned **200**; protected set/search requests returned **401**, with both documented authentication methods and with Node through the app's proxy transport. No real protected card metadata/images/prices were received. The key/binding/account access must be checked in secure settings; no precise cause or live integration success is claimed.
- Executed final lint (zero warnings), strict TypeScript, **96 unit/real PostgreSQL tests across 12 files**, and production build successfully. Adapter tests cover pagination, incomplete fields, price currencies/nulls, unknown data, identity, header/URL security, quota/no retries, partial cache retention and streaming bounds. Database tests prove source facts/version preservation, idempotent quote refresh, private/anonymous/direct-write denial, spoofed ownership rejection, canonical variants and cascading cleanup. All migrations replayed from an empty disposable PostgreSQL database with RLS on all 12 application tables; local schema corrections preserved existing data without reset.
- All **7 mobile Chromium E2E tests passed** on the final production build. Verification covers cached prices/reuse, private image access, missing-image fallback, unknown-list/audit preservation without a provider, alongside all existing deck/version/match/tournament/chart/auth/PWA flows. E2E explicitly disables the remote credential and uses only private synthetic fixtures; this does not verify actual external responses.
- Next: verify accepted live credentials, a real search/import and selected-set response, exact-printing artwork and basic quotes; then continue phase 5 practice and phase 6 collection. Current restrictions remain unverified; account recovery/export/deletion UI and hosted production configuration remain release gates. No full MVP or hosted deployment is claimed.
