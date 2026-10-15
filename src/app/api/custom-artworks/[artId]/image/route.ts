import { readFile } from "node:fs/promises";
import path from "node:path";
import { customArtworks } from "@/domain/custom-artworks";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/config";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ artId: string }> },
) {
  const { artId } = await params;
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const artwork = customArtworks.find((a) => a.id === artId);
  if (!artwork) return new Response(null, { status: 404, headers });
  if (!getSupabaseConfig()) return new Response(null, { status: 503, headers });
  const db = await createClient(),
    auth = await db.auth.getUser();
  if (auth.error || !auth.data.user)
    return new Response(null, { status: 401, headers });
  try {
    const bytes = await readFile(
      path.join(process.cwd(), "assets/custom-artworks", artwork.fileName),
    );
    return new Response(new Uint8Array(bytes), {
      headers: { ...headers, "Content-Type": "image/png" },
    });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
