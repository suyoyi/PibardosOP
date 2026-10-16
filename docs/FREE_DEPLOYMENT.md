# Free private-beta deployment

Use **Vercel Hobby** for Next.js and **Supabase Free** for PostgreSQL/Auth. A personal application for friends fits this deployment model. Use Vercel's supplied `*.vercel.app` address; buying a domain is unnecessary.

This guide prepares a new cloud database. Local accounts, decks, matches and discoveries are not automatically uploaded. Keep the local installation intact; transferring its records is a separate, deliberate migration.

Current personal beta: **https://pibardos-op.vercel.app**. On 2026-10-16, public HTTP checks verified the running web process, the configured login form, private-route redirects, manifest, service-worker script and icons. The owner confirmed the hosted schema has 17 tables with RLS and reported successful sign-in. Hosted save/reload behavior and multi-account isolation still require an authenticated production check; ordinary automated tests remain local.

The existing Vercel project is connected to **`suyoyi/pibardos-op`**, created by Vercel from an earlier snapshot of **`suyoyi/PibardosOP`**. These are two Git repositories; Vercel's lowercase project-name requirement did not rename the original GitHub repository. The snapshots' Git histories have been joined without deleting either history. The owner has selected **`suyoyi/pibardos-op` as the primary repository for future development and releases**. The original is retained for historical reference; the temporary dual-publication workflow is superseded by the release instructions below.

After the repository synchronization on 2026-10-16, Vercel reported a successful deployment of `a1a1255`. HTTPS checks confirmed that the hosted login now includes **Continuar con Google**, callback cancellation stays on the app with private/no-store and no-referrer headers, and private routes still redirect anonymous visitors. Real Google sign-in still requires the provider/client setup and an authenticated owner check; see [Google sign-in](GOOGLE_AUTH.md).

## Cost and account boundaries

Checked against official documentation on **2026-10-16**:

- [Vercel Hobby](https://vercel.com/docs/plans/hobby) is free for personal, non-commercial use, subject to usage limits.
- [Supabase Free](https://supabase.com/pricing) currently includes a 500 MB database and two active free projects. Free projects may pause after one week of inactivity. Review the dashboard before enabling paid resources.
- [Supabase's default email service](https://supabase.com/docs/guides/auth/auth-smtp) only delivers to organization team addresses. It is not a general-purpose email service for friends signing up. Use the manual private-beta account flow below or configure your own SMTP provider.

Application users do not need membership in either platform's project team. Platform login/project creation must be completed by the account holder unless authenticated deployment access has explicitly been connected to the development environment. Platform access tokens, database passwords and account passwords do not belong in this repository. The public application URL can be documented without those credentials.

## 1. Create the database

1. In [Supabase Dashboard](https://supabase.com/dashboard), select **New project** under an organization on the **Free** plan.
2. Use a recognizable project name such as `pibardos-op`, save its generated database password in your password manager and choose a European region near the users.
3. Wait for provisioning to finish. The new project's application schema should be empty.
4. Open [supabase/cloud-bootstrap.sql](../supabase/cloud-bootstrap.sql) in GitHub, choose the raw/copy-file view and copy the **entire file**. It contains schema and curated catalog records, not credentials.
5. In the new project's **SQL Editor**, create a query, paste the file and run it as the database owner. Run it once, as one transaction. The current bundle applies **17 migrations** and creates **17 RLS-enabled application tables**, including fan discoveries.
6. The final results should show 17 applied migrations, 17 application tables and 17 tables with RLS. The shared fan catalog contains seven cards and one extra illustration. Private user records start empty.

The bootstrap refuses an existing public application schema or migration history. It never resets a database and rolls back its changes if any statement fails. If it refuses a target, stop and inspect that project; do not remove its tables to bypass the guard. The migration history is recorded for subsequent incremental Supabase CLI updates. Do not use the bootstrap again for application updates.

Maintainers regenerate this committed file after adding migrations:

```sh
npm run db:cloud:bundle
node scripts/build-cloud-bootstrap.mjs --check
```

The integration suite executes the actual generated bundle in disposable PostgreSQL, checks migration history/RLS/catalog rows, forces a mid-install failure to verify rollback and confirms that rerunning it preserves existing private records.

## 2. Enable initial accounts without an email dependency

For a small private beta:

1. In Supabase **Authentication → Users**, choose **Add user → Create new user**. Create the owner's account with its email and a unique password, and use the dashboard's email-confirmed/auto-confirm option for this deliberately created account.
2. Create each friend's application account the same way. Use the app's existing email/password sign-in; do not invite friends to the Supabase organization to work around email-delivery limits.
3. For this private flow, disable public user signups in Supabase's Auth/provider settings. The application's registration action will be rejected by Auth while this setting is disabled; existing accounts can still sign in. There is no invitation or password-recovery UI claimed by this deployment.
4. For open registration later, configure a suitable SMTP service, review its own free limits and sender requirements, enable user signups and test actual confirmation/recovery delivery before relying on it.

Do not post database passwords, account passwords, secret API keys or service-role keys in chat, Git or screenshots. The two runtime values in the next section are specifically browser-safe project connection values.

## 3. Import the app into Vercel

1. Open [Vercel New Project](https://vercel.com/new), use the personal **Hobby** plan and connect GitHub. For the existing beta use `suyoyi/pibardos-op` from branch `main`; do not create another repository or project to deliver routine updates. A new deployment can import an existing GitHub repository directly even when its GitHub name contains uppercase characters; choose a lowercase Vercel project name such as `pibardos-op` separately.
2. Use the repository root (`./`) and the detected **Next.js** framework. Keep the default Next.js output directory. Use **Node.js 24.x**, install command **`npm ci`**, and build command **`npm run build`**. This app needs its Node server/functions; do not configure a static export, Docker startup or `local:start` as the cloud build.
3. In Supabase **Connect** or **Settings → API / Data API / API Keys**, find the project's HTTPS URL and **publishable** key. Older projects may provide the legacy `anon` key instead.
4. Add these Vercel environment variables before deploying, at least for **Production**:

   | Variable                               | Value                                                   |
   | -------------------------------------- | ------------------------------------------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`             | The new project's `https://PROJECT_REF.supabase.co` URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Its public `sb_publishable_...` key                     |

   For a legacy public `anon` key, use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead of the publishable-key variable. The application requires neither a database password nor a service-role key at runtime. OPTCG API needs no API key.

5. Click **Deploy** and wait for the actual build result. Copy the resulting production HTTPS URL; do not assume a particular subdomain is available.
6. Add the same connection variables separately to **Preview** if preview deployments should use this database. Preview writes then affect that same data. For now, Production-only settings are sufficient.

Next's `NEXT_PUBLIC_*` values are embedded at build time. If changed later, redeploy; updating dashboard values alone does not replace an existing build. Original fan illustrations are already included in the server function's file tracing and remain behind authenticated discovery checks. Vercel's normal origin protection remains enabled; no wildcard Server Actions origin is needed.

## 4. Set the authentication URL

In Supabase **Authentication → URL Configuration**:

- Set **Site URL** to the actual Vercel production HTTPS origin.
- Add that same origin and the specific return URLs needed by the app to **Redirect URLs**. Avoid broad wildcard allowlists. Email/password works independently; optional Google access requires the provider setup in [Google sign-in](GOOGLE_AUTH.md), including the app's `/auth/callback` return URL. Google credentials are stored only in Supabase.

If a confirmation email opens `localhost`, check the hosted project's Site URL first. For this beta use `https://pibardos-op.vercel.app`, with the corresponding root return URL in the allowlist, and save. Previously generated messages can retain the old redirect; changing settings does not rewrite a delivered email. If the account can already sign in, another account or confirmation request is unnecessary. If newly generated emails still contain a local redirect after fixing these settings, inspect the Auth email template for a hardcoded local URL and restore its appropriate Supabase confirmation-link template.

## 5. Verify the real deployment

- `/api/health` returns `{"status":"ok","application":"pibardos-op"}`. This only verifies the web process, not database/authentication readiness.
- Anonymous `/decks` redirects to `/login`; login must show the usable form instead of “Conexión pendiente”.
- Sign in with the deliberately created cloud account. Create/save a deck, reload it, record a match and confirm history/statistics use the saved result.
- Check the normal catalog and artwork. Select the fan expansion, reveal one role, sign out/in and confirm the discovery remains; another account must retain its own discoveries.
- Verify HTTPS, manifest/icons, service-worker registration and installation from an actual mobile browser. Private data still requires a connection; no offline write synchronization is provided.

A local successful build or an existing GitHub commit is not a verified hosted deployment. Record the real project references, production URL and actual verification outcomes before claiming completion. If a required account connection is unavailable, report that specific blocker instead of publishing a fabricated URL.

## Future updates

The cloud checkout's primary remote is now `origin` → `https://github.com/suyoyi/pibardos-op.git`. The previous repository remains as `original` → `https://github.com/suyoyi/PibardosOP.git`, for historical reference. The existing workspace directory can still be named `PibardosOP`; its directory name does not determine the Git destination. New checkouts and Codespaces should use the primary repository.

Inspect `git remote -v` before publishing from an older checkout. Preserve the old remote as `original`, configure canonical `origin`, fetch its `main`, and reconcile any local work without resets or force-pushing. Before a release, inspect `origin/main` for independent work. Publish authorized updates and verify the canonical reference:

```sh
git push origin HEAD:main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Vercel watches the primary repository's `main`. Future releases do not require updating the legacy repository. Git push success is separate from deployment success: inspect the Vercel result and request the production route affected by the release. If necessary, create a deployment from `https://github.com/suyoyi/pibardos-op/tree/main` in the existing Vercel project's Deployments view. Redeploying an old snapshot does not fetch unrelated newer commits.

When SQL migrations are added, apply those pending migrations to the reviewed cloud project using Supabase CLI before expecting new database features to work. The bootstrap records the original versions so future `migration list`/`db push --dry-run` can identify new migrations. Do not run `db reset` or the initial bootstrap against the cloud project for routine updates.

Local RLS/integration tests use the disposable local Supabase fixture. Do not point ordinary unit/integration/e2e test commands at a user's production database. Automatic cloud migration credentials are deliberately not added to CI by this guide.
