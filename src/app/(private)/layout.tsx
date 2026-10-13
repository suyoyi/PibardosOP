import Link from "next/link";
import { Compass, Settings } from "lucide-react";
import { requireUser } from "@/lib/supabase/server";
import { Navigation } from "@/components/navigation";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <div className="mx-auto min-h-dvh max-w-[1600px] md:grid md:grid-cols-[220px_1fr]">
      <aside className="flex items-center justify-between border-b border-border px-5 py-5 md:sticky md:top-0 md:h-dvh md:flex-col md:items-stretch md:justify-start md:border-r md:border-b-0 md:px-5 md:py-8">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-3 font-bold tracking-wide"
        >
          <span className="brand-mark">
            <Compass size={22} aria-hidden="true" />
          </span>
          <span>
            PIBARDOS <span className="text-accent">OP</span>
          </span>
        </Link>
        <div className="md:mt-12">
          <Navigation />
        </div>
        <Link
          href="/settings"
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted hover:text-foreground md:mt-auto"
        >
          <Settings size={19} aria-hidden="true" />
          <span className="sr-only md:not-sr-only">Ajustes</span>
        </Link>
      </aside>
      <main
        id="main-content"
        className="min-w-0 px-5 pt-7 pb-28 md:px-10 md:py-10 lg:px-14"
      >
        {children}
      </main>
    </div>
  );
}
