"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Layers3,
  GalleryVerticalEnd,
  Swords,
  ChartNoAxesCombined,
} from "lucide-react";

const destinations = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/decks", label: "Mazos", icon: Layers3 },
  { href: "/cards", label: "Cartas", icon: GalleryVerticalEnd },
  { href: "/matches", label: "Partidas", icon: Swords },
  { href: "/statistics", label: "Estadísticas", icon: ChartNoAxesCombined },
];
export function Navigation() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5 md:max-w-none md:grid-cols-1 md:gap-2">
        {destinations.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] transition-colors md:min-h-12 md:flex-row md:justify-start md:gap-3 md:px-4 md:text-sm ${active ? "text-accent md:bg-accent/10" : "text-muted hover:bg-white/5 hover:text-foreground"}`}
              >
                <Icon size={20} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
