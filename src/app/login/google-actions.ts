"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { googleCallbackUrl, googleSignInError } from "@/domain/auth";
import { getSupabaseConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "./actions";

export async function signInWithGoogle(
  _state: AuthState,
  form: FormData,
): Promise<AuthState> {
  const unavailable = { error: googleSignInError("unavailable")! };
  const config = getSupabaseConfig();
  if (!config) return unavailable;
  // Next Server Actions enforce the browser Origin before this function runs.
  const callback = googleCallbackUrl(
    (await headers()).get("origin"),
    form.get("next"),
  );
  if (!callback) return unavailable;
  let destination: string;
  try {
    // The SDK constructs an authorization URL even when a provider is disabled.
    // Check public Auth configuration first so users remain in a usable login UI.
    const settings = await fetch(new URL("/auth/v1/settings", config.url), {
      headers: { apikey: config.key },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!settings.ok || (await settings.json()).external?.google !== true)
      return unavailable;
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        scopes: "openid email profile",
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) return unavailable;
    const target = new URL(data.url);
    if (
      target.origin !== new URL(config.url).origin ||
      target.pathname !== "/auth/v1/authorize" ||
      target.searchParams.get("provider") !== "google"
    )
      return unavailable;
    destination = target.toString();
  } catch {
    return unavailable;
  }
  // Redirect throws by design and must remain outside the error handler.
  redirect(destination);
}
