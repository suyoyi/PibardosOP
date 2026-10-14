# Pibardos OP

A Spanish mobile-first personal workspace for One Piece Card Game. The app includes secure authentication, private manual cards, an optional BerryWallet adapter, confirmed deck imports, a versioned deck builder, match history, tournaments and charts of saved results. Practice and collection/offline UI are subsequent phases; see `PROJECT_STATUS.md` and `docs/ARCHITECTURE.md`.

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

## Optional BerryWallet connection

Configure `BERRYWALLET_API_KEY` in the server's secret settings, or add your own key to ignored `.env.local` for local development. Restart/rebuild Next.js after a credential change. Never share the key in chat, commit it, or use a `NEXT_PUBLIC_` prefix. The adapter supports this cloud's network-secret HTTP proxy without changing local Supabase requests.

In **Cartas**, explicitly search BerryWallet and add the desired printing, or load one collection with an explicit language. Imported cards become private catalog entries usable by decks and opponent selection. Missing/invalid facts are reported; manual entry remains available. In the import preview, **Resolver desconocidas con BerryWallet** optionally resolves up to 15 codes; ambiguous printings require selection in Cartas. Every preview and provider notice is retained; saving still requires confirmation.

Card detail shows separately cached CardMarket EUR and TCGPlayer USD quotes, the consultation date, and a refresh action with a 15-minute reuse interval. Original card facts stay immutable to preserve deck history. Authenticated artwork passes through a server proxy without exposing credentials or storing image files. Unavailable images use the existing placeholder.

The documented free quota is 100 requests/hour and 1,000/day shared across games; searches, details and images consume provider requests. This integration uses basic prices included in responses, never the paid `/op/prices` endpoint or automatic subscriptions. See [provider review, limits and live verification](docs/BERRYWALLET.md). **The current environment's live requests return HTTP 401; actual card/image/quote responses remain unverified until the credential is accepted.** Controlled fixtures verify the application flows without querying a live card website.

## Using the competitive workflows

1. Add your leader, opponent leaders and missing main-deck cards in **Cartas** using facts from your physical cards. For alternate printings/reprints choose their original canonical identity. Manual data remains explicitly unverified, and no copyrighted images are bundled or downloaded.
2. In **Mazos → Crear o importar mazo**, paste quantities and printed codes. Review recognized cards, aggregated duplicates and every unknown/malformed line. Correct codes or add missing cards, then review again. Each preview is retained separately in import history; failed/unknown previews are not overwritten. Confirm the preview before saving.
3. Save incomplete lists as **Borrador**. **Activo** requires 50 main cards, valid types, a leader, known compatible colors and canonical copy/restriction limits. DON is separate. Active construction does not certify tournament legality. Cards/leader/format changes create immutable versions; rename/description/tag changes alone retain the current version. Compare versions or download the text list from deck detail. Text export retains quantities/codes but not alternate artwork selection.
4. In **Partidas → Registrar partida**, choose the exact deck version, opponent leader, Victoria/Derrota/Empate, and Primero/Segundo. Optional fields include UTC date/time, opponent name, type and notes. Displayed history uses Madrid time. Editing/deleting updates the derived statistics; deletion requires confirmation.
5. Open **Torneos** from Partidas or Inicio. Choose an exact version, record numbered rounds through the same match form, and record optional placement. A duplicate round rolls back the whole submission. The selected version/format cannot change after games exist. Archived events retain rounds/history and accept corrections, but no new rounds.
6. **Estadísticas** provides deck/format filters and interactive charts with accessible data tables: deck, exact version, opponent leader, first/second and monthly results. Every percentage shows decisive sample size; draws are excluded. Rankings flag fewer than five decisive games. Queries paginate all rows instead of silently using PostgREST's first page.

To update an existing local checkout, stop its web-server terminal first, run `git pull --ff-only`, then `npm run local:start`. The launcher restores changed dependencies and `db:start` applies pending local migrations without resetting data. In Codespaces stop the old preview before running `npm run preview:start` again; production previews do not hot-reload source changes.

## Production / Vercel

1. Create a Supabase project and apply the versioned migrations in `supabase/migrations` to a reviewed target. Configure email confirmation, a production SMTP provider, strong-password policy and Auth rate limits.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in deployment settings (legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works). `.env.example` contains placeholders only. The application uses no service-role key.
3. Configure Supabase Auth site URL and redirect allowlist for the actual HTTPS origin. Email confirmation returns users to the app; users then log in with their confirmed account.
4. Vercel detects Next.js; install with `npm ci` and build with `npm run build`. Verify deployed login, RLS and PWA behavior before calling a deployment complete.

Installation requires HTTPS (loopback is allowed during testing). The service worker caches only original public icons and the offline notice. Private responses and credentials are never cached. Offline reads/writes, synchronization and conflict resolution are not implemented. Browser/OS install prompts vary; the manifest and service worker are the foundation, not a guarantee of an install prompt on every device.

Production release gates still include account recovery/export/deletion workflows, the practice simulator, collection workflows, externally verified restriction data and accepted provider credentials and live response verification. The full MVP and a production deployment are not claimed complete.

## Security and data

All application tables have RLS. Private tables use owner checks; composite foreign keys enforce ownership of parent/version/event relationships. Shared cards and restrictions are read-only to authenticated clients. Owners can insert private, immutable manual cards; RLS and database triggers prevent cross-owner card references. `save_deck` and `save_deck_version` lock the owned parent and atomically save metadata, immutable snapshots, structured differences and import confirmation. An expected-version token rejects stale edits; metadata-only saves do not create redundant snapshots. The domain validator checks construction and dated restrictions, while complete tournament legality stays unverified without a reviewed restriction dataset. `save_match` saves the game and optional round in one transaction with a fixed submission ID. Event version/format must agree with all its games; archival preserves history and permits corrections of existing games.

Inventory allocations use physical printing rows, row locks and quantity checks; virtual deck contents never establish ownership. Matches reference exact versions. Draws are excluded from win-rate denominator: W/(W+L), with total and decisive sample sizes shown and no percentage when W+L is zero.

No franchise artwork is bundled. Icons are original vectors rendered by `scripts/generate-icons.mjs`; regenerate with the installed `sharp` transitive Next.js dependency. The application is independent and has no official affiliation.
