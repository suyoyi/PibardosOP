import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/config";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await supabase.auth.getUser();
  // Private data must not be stored by a shared browser/CDN cache.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!api/health|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|offline).*)",
  ],
};
