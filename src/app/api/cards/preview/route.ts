import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/config";
import { optcgClient } from "@/lib/optcg";
import { safeOptcgImage } from "@/domain/optcg";
export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!getSupabaseConfig()) return new Response(null, { status: 503, headers });
  const db = await createClient(),
    auth = await db.auth.getUser();
  if (auth.error || !auth.data.user)
    return new Response(null, { status: 401, headers });
  // Public dataset art previews have no private card UUID yet. Authentication
  // plus a strict public-provider URL boundary avoids persisting search results.
  const raw = new URL(request.url).searchParams.get("url"),
    url = raw && raw.length <= 2048 ? safeOptcgImage(raw) : null;
  if (!url) return new Response(null, { status: 400, headers });
  try {
    const image = await optcgClient().image(url);
    return new Response(image.body, {
      headers: { ...headers, "Content-Type": image.type },
    });
  } catch {
    return new Response(null, { status: 502, headers });
  }
}
