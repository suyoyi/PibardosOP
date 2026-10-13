# Pibardos OP

A Spanish mobile-first personal workspace for One Piece Card Game. Phase 1 provides the application shell, real authentication, empty-data views, secure database foundation and PWA basics. The full deck/match/practice MVP is delivered in subsequent phases; see `PROJECT_STATUS.md` and `docs/ARCHITECTURE.md`.

## Try the app in your browser with GitHub Codespaces

[Create a Codespace for Pibardos OP](https://codespaces.new/suyoyi/PibardosOP?ref=main)

Sign in to GitHub, create a Codespace from `main`, and wait for its post-start command. The repository's devcontainer installs Node 24 and Docker-in-Docker, restores pinned dependencies, starts local Supabase, prepares public connection settings and runs a production preview. No Vercel deployment or external Supabase account is required for this development preview.

Open **Ports → 3000 → Open in Browser** when the terminal reports that Pibardos OP is ready. Create an account from the Spanish access page; local email confirmation is disabled. The first startup downloads images and builds the app, so it can take a few minutes. Keep the forwarded port private, which is Codespaces' default. Supabase database/API ports are not forwarded.

The current phase supports account access and navigation through real empty-data views. Deck importing/editing, match entry and practice are subsequent phases. Data belongs to this Codespace; do not delete it if you need to keep its local accounts/data. Codespaces usage is subject to your GitHub account's available quota and settings.

To retry a failed startup or resume the preview, run `npm run preview:start` in the Codespace terminal. The launcher preserves existing `.env.local` and injected public bindings, checks actual service readiness, and reuses a healthy existing app rather than launching duplicates. It builds only when it needs to start the preview server. Preview logs are in `/tmp/pibardos-preview-3000.log`. For code development, stop the preview process before switching to `npm run dev`; the production preview does not hot-reload edits.

Next.js trusts only this Codespace's exact forwarded hostname for development assets and Server Actions; there is no wildcard exception for other Codespaces. HTTPS forwarding is managed by GitHub. The devcontainer configuration and launcher are validated locally; provisioning in your GitHub account still requires you to create the Codespace.

## Local development

Requirements: Node 22.12+ (validated with Node 24), npm, Docker with a running daemon. Dependencies are pinned in `package-lock.json`.

```bash
npm ci
npm run db:start
npm run setup:local
npm run dev
```

`setup:local` creates an ignored `.env.local` using the **public** local URL/key from CLI status. It refuses to overwrite an existing file and never copies a service-role key. Local signup does not require email confirmation; local accounts are development-only. The catalog is empty by design. Do not load synthetic test fixtures into production.

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

## Production / Vercel

1. Create a Supabase project and apply the versioned migrations in `supabase/migrations` to a reviewed target. Configure email confirmation, a production SMTP provider, strong-password policy and Auth rate limits.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in deployment settings (legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` also works). `.env.example` contains placeholders only. The application uses no service-role key.
3. Configure Supabase Auth site URL and redirect allowlist for the actual HTTPS origin. Email confirmation returns users to the app; users then log in with their confirmed account.
4. Vercel detects Next.js; install with `npm ci` and build with `npm run build`. Verify deployed login, RLS and PWA behavior before calling a deployment complete.

Installation requires HTTPS (loopback is allowed during testing). The service worker caches only original public icons and the offline notice. Private responses and credentials are never cached. Offline reads/writes, synchronization and conflict resolution are not implemented. Browser/OS install prompts vary; the manifest and service worker are the foundation, not a guarantee of an install prompt on every device.

Production release gates still include account recovery/export/deletion workflows, phase-specific private CRUD, externally verified restriction data and licensed providers. This foundation is not an MVP release or a production deployment.

## Security and data

All application tables have RLS. Private tables use owner checks; composite foreign keys enforce ownership of parent/version/event relationships. Cards and restrictions are read-only to authenticated clients. Snapshot writes are restricted to `save_deck_version`, which locks the owned parent, validates the payload, inserts a complete immutable snapshot and updates the current pointer atomically. Draft card-count/color/restriction validation is a separate domain feature planned for phases 2/3; no tournament legality is claimed now.

Inventory allocations use physical printing rows, row locks and quantity checks; virtual deck contents never establish ownership. Matches reference exact versions. Draws are excluded from win-rate denominator: W/(W+L), with total and decisive sample sizes shown and no percentage when W+L is zero.

No franchise artwork is bundled. Icons are original vectors rendered by `scripts/generate-icons.mjs`; regenerate with the installed `sharp` transitive Next.js dependency. The application is independent and has no official affiliation.
