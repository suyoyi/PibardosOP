import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/lib/config";
import type { Database } from "@/lib/supabase/database.types";

export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase no está configurado.");
  const store = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        // Server Components cannot write cookies. The proxy refreshes them first.
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* read-only render */
        }
      },
    },
  });
}

export async function requireUser() {
  if (!getSupabaseConfig()) redirect("/login");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, user: data.user };
}
