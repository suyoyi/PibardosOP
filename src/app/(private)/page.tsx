import { requireUser } from "@/lib/supabase/server";
import { getDeckWorkspace, readAll } from "@/lib/data";
import { buildDashboard } from "@/domain/dashboard";
import { HomeDashboard } from "@/components/home-dashboard";

export default async function Dashboard() {
  const { supabase } = await requireUser();
  const [workspace, matches] = await Promise.all([
    getDeckWorkspace(supabase),
    readAll((from, to) =>
      supabase
        .from("matches")
        .select("*")
        .order("played_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
  ]);
  return <HomeDashboard data={buildDashboard({ ...workspace, matches })} />;
}
