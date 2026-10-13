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

Product limitations:

- Foundation screens read real data but deck creation/import/editing, full version comparison UI, match/tournament entry, detailed analytics, simulator and collection UI are subsequent phases. No disabled action pretends to implement them.
- Catalog intentionally empty; no external provider, artwork or current restriction data is asserted verified.
- Production Supabase account/configuration, email delivery and hosted deployment are still pending. Local email confirmation is disabled for development only.
- Account recovery/export/deletion and offline read/write synchronization remain release gates; no full MVP, production deployment or offline synchronization is claimed.

## Next phases

Implement cards/import, deck editing/version comparisons, competitive tracking, practice and collection in that order. Full MVP and production deployment are not complete.
