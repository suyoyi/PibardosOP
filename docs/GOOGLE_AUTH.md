# Google sign-in

The login screen supports Google and the existing email/password flow. Supabase remains the identity and session authority; private data still uses the existing account UUID and RLS policies. No database migration or additional Vercel environment variable is needed. Google client credentials belong only in Supabase's provider settings.

## Configure the personal beta

These instructions use the owner's existing hosted projects. Administrative dashboard access is not connected to the development environment; the owner must perform these settings while signed into the relevant accounts.

1. Open [Google Cloud Console](https://console.cloud.google.com/), create/select a project named `Pibardos OP`, and open **Google Auth Platform**. Choose **Get started** if prompted. Set the application name and the owner's support/contact email.
2. Choose **External** as the audience. While the application is in **Testing**, add the owner's Google address and friends who will test it under **Audience → Test users**. Request only basic identity permissions: `openid`, email and profile. The application requests no Drive, Gmail, offline access or refresh token for Google APIs. Custom branding/public publishing may require Google's own domain/verification steps; do not claim those are already complete.
3. Open **Clients → Create client**, choose **Web application**, and name it `Pibardos OP web`. Use these exact values:

   | Google field                  | Value                                                       |
   | ----------------------------- | ----------------------------------------------------------- |
   | Authorized JavaScript origins | `https://pibardos-op.vercel.app`                            |
   | Authorized redirect URIs      | `https://gkzsdqpxnxvncmlzfdxz.supabase.co/auth/v1/callback` |

4. In [Supabase Dashboard](https://supabase.com/dashboard/project/gkzsdqpxnxvncmlzfdxz/auth/providers), open **Authentication → Sign In / Providers → Google**, enable it, paste Google's **Client ID** and **Client Secret**, and save. Confirm the displayed provider callback matches the Google redirect URI above. Do not enable the skip-nonce or unverified-email options as a workaround.
5. Under Supabase **Authentication → URL Configuration**, set **Site URL** to `https://pibardos-op.vercel.app` and include `https://pibardos-op.vercel.app/auth/callback` in **Redirect URLs**. Keep the root return URL required for existing email confirmations. The app attaches a validated `next` query parameter to its callback. Using the production origin as Site URL permits its callback paths; broad wildcard preview-domain access is unnecessary.
6. If public signups were disabled for the earlier private beta, either pre-create/confirm each intended friend's account with the same Google email, or deliberately enable signups in Supabase to allow new Google users. Google Testing/test-user configuration is not an application-level invitation system. Do not describe the app as invite-only while Supabase permits arbitrary registration.
7. After Vercel has deployed the commit containing this feature, open [the hosted login screen](https://pibardos-op.vercel.app/login), click **Continuar con Google**, choose the intended account and complete consent. Verify the returned account can reload its saved decks. Repeat with another account to confirm separation. Do not post credentials, authorization codes, session cookies or callback URLs containing codes in screenshots or chat.

Google redirects to **Supabase**; Supabase returns the session code to the **application**. Registering the app callback in Google's redirect-URI field causes a mismatch. No Google secret should be entered into Vercel, `.env.local`, `NEXT_PUBLIC_*`, Git or this chat. Basic Google sign-in does not require adding Google billing or a paid Supabase plan; existing hosting/Auth usage limits still apply.

## Existing accounts and local development

Supabase normally links an OAuth identity automatically to an existing account with the same **verified email**. Choose the same Google address used for the original Supabase account. A different email can create a separate user and therefore an empty private workspace. The app does not merge accounts or copy their decks automatically.

Local Supabase has Google disabled by default; the button displays a friendly message and email/password still works. Local testing does not require Google credentials. To enable real Google locally, configure the local Auth provider securely using Supabase's supported local provider configuration, register the corresponding local **Supabase Auth** callback with Google, and permit the local **application** callback in Auth's redirect configuration. Do not point automated tests at production or enable wide allowlists solely for tests.

The server action uses the Next-validated request Origin, checks Supabase's public provider settings on click with an eight-second timeout, then starts SSR PKCE OAuth. The SDK saves a verifier cookie before redirecting. `/auth/callback` exchanges the returned code using that cookie and writes the session through the existing server client. Same-origin return paths are validated, raw provider descriptions are discarded, and relative callback redirects remain on the browser origin behind reverse proxies. Callback responses use private/no-store and no-referrer headers; the callback-specific framework header overrides the general referrer policy. No Google API tokens are exposed in application UI.

## Troubleshooting

- **Access with Google unavailable:** enable/save the Google provider in the correct Supabase project and verify Auth is reachable. Email sign-in remains available.
- **`redirect_uri_mismatch`:** the Google client's redirect URI must be the exact Supabase `/auth/v1/callback` address, without a trailing slash. Check the client is a Web application.
- **Google blocks a test account:** add the correct address under the External application's test users, or inspect the account's organization restrictions. Do not bypass Google's consent warnings.
- **New account rejected:** inspect Supabase's signup setting; an existing confirmed account can be deliberately created for the intended email.
- **Return to localhost:** correct Supabase Site URL and Redirect URLs. Start sign-in again from the production app.
- **Expired code or missing verifier:** restart from **Continuar con Google** in the same browser. Avoid switching devices, private-browsing contexts or reusing a callback link; codes are single-use and tied to PKCE cookies.
- **Account appears empty:** check the Google email matches the existing verified account before creating data or attempting a separate migration.

## Validation boundary and official references

Automated tests cover local fallback/CSRF, safe redirects, errors, and the real SSR SDK's verifier/session-cookie exchange with a synthetic Auth response. Existing local password/RLS tests remain separate. These tests do not prove that the owner's Google client, consent screen or hosted provider settings are configured, or that a real hosted Google login succeeded.

Official references consulted on 2026-10-16:

- [Supabase Google provider](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Next.js SSR](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server)
