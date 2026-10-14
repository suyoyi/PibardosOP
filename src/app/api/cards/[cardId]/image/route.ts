import { createClient } from "@/lib/supabase/server";
import { optcgClient } from "@/lib/optcg";
import { getSupabaseConfig } from "@/lib/config";
import { uuid } from "@/domain/forms";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const { cardId } = await params;
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!uuid.safeParse(cardId).success)
    return new Response(null, { status: 404, headers });
  if (!getSupabaseConfig()) return new Response(null, { status: 503, headers });
  const db = await createClient(),
    auth = await db.auth.getUser();
  if (auth.error || !auth.data.user)
    return new Response(null, { status: 401, headers });
  const { data, error } = await db
    .from("optcg_card_items")
    .select("image_url")
    .eq("card_id", cardId)
    .maybeSingle();
  if (error || !data?.image_url)
    return new Response(null, { status: 404, headers });
  try {
    const image = await optcgClient().image(data.image_url!);
    return new Response(image.body, {
      headers: { ...headers, "Content-Type": image.type },
    });
  } catch {
    return new Response(null, { status: 502, headers });
  }
}
