import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
export default async function ImportsPage() {
  await requireUser();
  redirect("/decks/import");
}
