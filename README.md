# Pibardos OP

A Spanish mobile-first personal workspace for One Piece Card Game. The app includes secure authentication, private manual cards, OPTCG API card imports, confirmed deck imports, a versioned deck builder, match history, tournaments and charts of saved results. Practice and collection/offline UI are subsequent phases; see `PROJECT_STATUS.md` and `docs/ARCHITECTURE.md`.

## Try the app in your browser with GitHub Codespaces

[Create a Codespace for Pibardos OP](https://codespaces.new/suyoyi/PibardosOP?ref=main)

Sign in to GitHub, create a Codespace from `main`, and wait for its post-start command. The repository's devcontainer installs Node 24 and Docker-in-Docker, restores pinned dependencies, starts local Supabase, prepares public connection settings and runs a production preview. No Vercel deployment or external Supabase account is required for this development preview.

Open **Ports → 3000 → Open in Browser** when the terminal reports that Pibardos OP is ready. Create an account from the Spanish access page; local email confirmation is disabled. The first startup downloads images and builds the app, so it can take a few minutes. Keep the forwarded port private, which is Codespaces' default. Supabase database/API ports are not forwarded.

You can create manual cards, review and import decklists, edit/version decks, record games and tournament rounds, and view charts from your saved results. The catalog starts empty and current tournament legality remains unverified. Data belongs to this Codespace; do not delete it if you need to keep its local accounts/data. Codespaces usage is subject to your GitHub account's available quota and settings.

To retry a failed startup or resume the preview, run `npm run preview:start` in the Codespace terminal. The launcher preserves existing `.env.local` and injected public bindings, checks actual service readiness, and reuses a healthy existing app rather than launching duplicates. It builds only when it needs to start the preview server. Preview logs are in `/tmp/pibardos-preview-3000.log`. For code development, stop the preview process before switching to `npm run dev`; the production preview does not hot-reload edits.

Next.js trusts only this Codespace's exact forwarded hostname for development assets and Server Actions; there is no wildcard exception for other Codespaces. HTTPS forwarding is managed by GitHub. The devcontainer configuration and launcher are validated locally; provisioning in your GitHub account still requires you to create the Codespace.

## Local development

For Windows, install Node.js 24, Git and Docker Desktop with the WSL 2 / Linux-container engine. Open Docker Desktop before starting. Clone the repository into a user-owned folder and open it as a **local** project in your desktop coding app:

```powershell
git clone https://github.com/suyoyi/PibardosOP.git
cd PibardosOP
npm run local:start
```

`local:start` restores locked dependencies when the lockfile changes, starts and verifies Supabase and applies pending local migrations, creates public `.env.local` settings only when absent, builds the application and starts a foreground loopback server. After checking the actual health and login form, it opens the default browser (PowerShell `Start-Process` on Windows). Keep the terminal open. Ctrl+C stops the web server; `npm run db:stop` stops local Supabase while retaining data. Existing healthy instances and configuration are preserved. To use a different port set `PIBARDOS_APP_PORT`; to suppress browser opening set `PIBARDOS_OPEN_BROWSER=false`.

This cloud chat cannot execute commands on your Windows PC. Once the repository is open in a local desktop-agent session, ask that session to run `npm run local:start`. Browser preview inside the desktop app still depends on that app's available tools; the normal Windows browser works independently.

Requirements: Node 22.12+ (validated with Node 24), npm, Docker with a running daemon. Dependencies are pinned in `package-lock.json`.

```bash
npm ci
npm run db:start
npm run setup:local
npm run dev
```

`setup:local` creates an ignored `.env.local` using the **public** local URL/key from CLI status. It refuses to overwrite an existing file and never copies a service-role key. Local signup does not require email confirmation; local accounts are development-only. The catalog starts empty; enter actual card facts through **Cartas → Añadir carta manual**. Manual entries are private and labeled unverified. Do not load synthetic test fixtures into production.

The Supabase wrapper keeps CLI state in a writable sibling `.supabase-cli` directory (override with `SUPABASE_HOME`) and selects the CLI's official digest-pinned reduced images via `SUPABASE_USE_SLIM_IMAGES=true`. The standard PostgreSQL image exceeded this cloud Docker daemon's storage capacity. Keep the same image-family setting when restarting or resetting the database. Optional Studio, Storage, Realtime, analytics and Edge services are disabled for this phase. The PostgreSQL/Auth/API gateway services are required. Containers/volumes retain local development data; live processes must restart after a cloud snapshot restore.

On this cloud host, the injected HTTP proxy makes the container's BusyBox `wget` loopback Auth probe return 403 while the actual gateway health endpoint returns 200. Use `PIBARDOS_HTTP_READINESS=true npm run db:start` here. This documented opt-in replaces the failing Docker probe with mandatory PostgreSQL `select 1`, Auth health JSON and PostgREST OpenAPI checks; the script still fails if any actual service is unavailable. Normal environments retain the CLI's container health checks by default. Functional authentication is additionally verified by E2E tests. This is a local proxy workaround, not a production setting.

```bash
npm run check            # lint, strict types, unit + real PostgreSQL integration tests, build
npm run test:e2e         # production build required; starts/stops a server on port 3100
npm run db:types         # regenerate typed database contract after migration changes
npm run db:stop          # preserves local data
```

Integration tests require local Supabase and fail if unavailable; they are never silently skipped. They run against loopback-only database connections with synthetic transactional fixtures and rollback. E2E tests create/delete dedicated local accounts. E2E uses installed `/usr/bin/chromium` when available; otherwise install the pinned Playwright browser with `npx playwright install chromium`. Override its executable with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

`npm run db:reset` **deletes local development data** and replays migrations; only use it on disposable databases. Production migrations are applied with the Supabase CLI to a reviewed linked project, never with the local reset command. After changing `.env.local`, restart Next.js and rebuild before E2E.

## OPTCG API catalog and imports

OPTCG API is the current external provider and **needs no API key**. In **Cartas**, search by code/name, select a group (sets, starter decks, promos or DON), then add the desired printing. Printed ST/P codes route to their documented category. You can also load one chosen collection, such as `OP01`, `EB01`, `PRB01` or `ST01`; no full-catalog background download occurs. API data is English; manual entry remains available for missing or incomplete cards.

In **Mazos → Crear mazo**, follow three steps: **1. Líder**, **2. Cartas**, **3. Nombre**. Selecting a leader opens its compatible main-card gallery. +/− controls enforce at most four copies across all canonical printings/reprints and at most 50 main cards. DON remains an optional separate ten-card list. Changing a leader keeps existing entries and explains incompatibilities instead of silently deleting them. Give the deck its name in the final step; incomplete lists can be saved explicitly as drafts. Editing retains the direct builder and version notes.

The leader and card galleries show one tile per printed code. Tap **Ver variantes** to open the available artwork/reprint grid, then select the exact leader printing or use +/− on each main-card printing. The dialog also consults other source categories/expansions for that code; all printings retain independent quantities and share the canonical copy budget. The chosen leader's artwork/name/color appear above card selection; tap its portrait to enlarge the exact selected artwork. Escape or the close button returns to the previous control, while pending additions complete before closing. Browsing variants/zooming never saves a deck or imports all previews.

Four primary controls remain visible: **Buscar carta** (name or printed number), **Expansión**, **Color** and **Coste**. Expansion/starter names come from the provider, not a hardcoded invented list. `op17-99` normalizes to `OP17-099`; card names are not rewritten. Without an expansion filter, browsing queries compatible colors across documented set/starter/promo endpoints. An explicit expansion narrows the requests. Source JSON is cached and pagination shows 24 candidates without refetching metadata. Missing provider metadata shows a code fallback; saved cards remain usable when the provider fails. Only English choices appear and images remain transient.

**Importar lista de texto** is an optional expandable workflow. Review recognized/unknown/malformed entries before proceeding; unknown lines remain visible and block saving until corrected. The final step requires import confirmation. Moving back through the wizard preserves quantities, name and advanced fields. Selected card metadata is privately cached, while the deck is saved only with **Guardar mazo**.

In the deck import preview, **Resolver desconocidas con OPTCG API** explicitly consults up to 15 missing printed codes. It chooses a unique base printing when the provider identifies one, otherwise a single exact match. Ambiguous variants require catalog selection. Review recognized/unknown/malformed entries and confirm before saving; provider notices and original text remain in import history. A missing code does not prevent resolving subsequent codes; network/quota/persistence failures stop the batch safely.

Saved cards and price/image references are private in Supabase. Canonical roots preserve copy limits across variants. Repeated imports refresh quotes and image references without changing card facts used by historical deck snapshots. Card detail shows market/inventory quotes, the consultation time and the provider's date; **the API does not declare currency, so amounts remain unlabeled by EUR/USD and the limitation is shown explicitly**. Missing prices are never zero. Price refresh reuses owner cache younger than 15 minutes.

Server-side public metadata responses are reused for one hour by default to reduce provider traffic (`OPTCG_CACHE_SECONDS=3600`; set `0` to disable or a value up to `86400`). Images use an authenticated, fixed-host transient proxy with no-store responses and placeholders for absent/rejected artwork; no image files are downloaded to permanent storage. There is no promised numeric daily quota or guaranteed complete catalog. See [provider review and verification](docs/OPTCG_API.md).

BerryWallet is retired from UI, import resolution and image requests. Existing BerryWallet facts, prices and deck references remain readable, with historical quotes labeled and refresh removed. Its key is unnecessary and unused by current app routes.

## Home leader dashboard

**Inicio** shows your overall saved record and a visual selector of leaders from nonarchived decks. Alternate printings of the same canonical leader share one selector entry. Choose a leader to see its wins/losses, decisive sample size, six most recent games, monthly results and first/second breakdown. Win rate uses wins / (wins + losses); no decisive games show an absent percentage rather than zero. Small samples are explicitly labeled.

Use **Mazo para la curva** to choose between lists with the same leader. The curve weights each main-deck printing by its saved quantity, includes zero cost and a separate missing-cost bucket, and excludes the leader and DON. The current version and main/DON counts are visible; **Registrar partida** opens that exact selected version. Leader results span all versions actually played with that canonical leader, including archived lists. Changing a deck's current leader does not move historical results to the new leader. Empty accounts/drafts offer working next actions without fake data.

New games only accept **Victoria** or **Derrota**, enforced in forms, server validation and additive database triggers. Previous unsupported-result records are retained without converting/deleting them; the UI marks them for review and omits a third outcome from controls/charts. Their presence is explained if it affects the sample.

## Using the competitive workflows

1. Add your leader, opponent leaders and missing main-deck cards in **Cartas** using facts from your physical cards. For alternate printings/reprints choose their original canonical identity. Manual data remains explicitly unverified, and no copyrighted image files are bundled or stored permanently.
2. In **Mazos → Crear o importar mazo**, paste quantities and printed codes. Review recognized cards, aggregated duplicates and every unknown/malformed line. Correct codes or add missing cards, then review again. Each preview is retained separately in import history; failed/unknown previews are not overwritten. Confirm the preview before saving.
3. Save incomplete lists as **Borrador**. **Activo** requires 50 main cards, valid types, a leader, known compatible colors and canonical copy/restriction limits. DON is separate. Active construction does not certify tournament legality. Cards/leader/format changes create immutable versions; rename/description/tag changes alone retain the current version. Compare versions or download the text list from deck detail. Text export retains quantities/codes but not alternate artwork selection.
4. In **Partidas → Registrar partida**, choose the exact deck version, opponent leader, Victoria/Derrota/Empate, and Primero/Segundo. Optional fields include UTC date/time, opponent name, type and notes. Displayed history uses Madrid time. Editing/deleting updates the derived statistics; deletion requires confirmation.
5. Open **Torneos** from Partidas or Inicio. Choose an exact version, record numbered rounds through the same match form, and record optional placement. A duplicate round rolls back the whole submission. The selected version/format cannot change after games exist. Archived events retain rounds/history and accept corrections, but no new rounds.
6. **Estadísticas** provides deck/format filters and interactive charts with accessible data tables: deck, exact version, opponent leader, first/second and monthly results. Every percentage shows win/loss sample size. Rankings flag fewer than five decisive games. Queries paginate all rows instead of silently using PostgREST's first page.

To update an existing local checkout, stop its web-server terminal first, run `git pull --ff-only`, then `npm run local:start`. The launcher restores changed dependencies and `db:start` applies pending local migrations without resetting data. In Codespaces stop the old preview before running `npm run preview:start` again; production previews do not hot-reload source changes.

## Production / Vercel

1. Create a Supabase project and apply the versioned migrations in `supabase/migrations` to a reviewed target. Configure email confirmation, a production SMTP provider, strong-password policy and Auth rate limits.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in deployment settings (legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works). `.env.example` contains placeholders only. The application uses no service-role key.
3. Configure Supabase Auth site URL and redirect allowlist for the actual HTTPS origin. Email confirmation returns users to the app; users then log in with their confirmed account.
4. Vercel detects Next.js; install with `npm ci` and build with `npm run build`. Verify deployed login, RLS and PWA behavior before calling a deployment complete.

Installation requires HTTPS (loopback is allowed during testing). The service worker caches only original public icons and the offline notice. Private responses and credentials are never cached. Offline reads/writes, synchronization and conflict resolution are not implemented. Browser/OS install prompts vary; the manifest and service worker are the foundation, not a guarantee of an install prompt on every device.

Production release gates still include account recovery/export/deletion workflows, the practice simulator, collection workflows, externally verified restriction data and reviewed hosted provider behavior. The full MVP and a production deployment are not claimed complete.

## Security and data

All application tables have RLS. Private tables use owner checks; composite foreign keys enforce ownership of parent/version/event relationships. Shared cards and restrictions are read-only to authenticated clients. Owners can insert private, immutable manual cards; RLS and database triggers prevent cross-owner card references. `save_deck` and `save_deck_version` lock the owned parent and atomically save metadata, immutable snapshots, structured differences and import confirmation. An expected-version token rejects stale edits; metadata-only saves do not create redundant snapshots. The domain validator checks construction and dated restrictions, while complete tournament legality stays unverified without a reviewed restriction dataset. `save_match` saves the game and optional round in one transaction with a fixed submission ID. Event version/format must agree with all its games; archival preserves history and permits corrections of existing games.

Inventory allocations use physical printing rows, row locks and quantity checks; virtual deck contents never establish ownership. Matches reference exact versions. Win rate uses W/(W+L), with total and decisive sample sizes shown and no percentage when W+L is zero.

No franchise artwork is bundled. Icons are original vectors rendered by `scripts/generate-icons.mjs`; regenerate with the installed `sharp` transitive Next.js dependency. The application is independent and has no official affiliation.
