import { NextResponse, type NextRequest } from "next/server";
import { safeReturnPath } from "@/domain/auth";
import { getSupabaseConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeReturnPath(searchParams.get("next"));
  // Relative Location stays on the browser's origin even behind a reverse proxy.
  // request.nextUrl can contain the internal listener address in production.
  const redirect = (path: string) =>
    new NextResponse(null, {
      status: 303,
      headers: {
        Location: path,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  const failure = (reason: "cancelled" | "failed" | "unavailable") => {
    const params = new URLSearchParams({ oauth_error: reason });
    if (next !== "/") params.set("next", next);
    return redirect(`/login?${params}`);
  };
  if (searchParams.has("error"))
    return failure(
      searchParams.get("error") === "access_denied" ? "cancelled" : "failed",
    );
  const code = searchParams.get("code");
  if (!code || code.length > 2048 || searchParams.getAll("code").length !== 1)
    return failure("failed");
  if (!getSupabaseConfig()) return failure("unavailable");
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) return failure("failed");
  } catch {
    return failure("failed");
  }
  return redirect(next);
}
