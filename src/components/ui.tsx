import Link from "next/link";
import { Compass, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-8">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        {description}
      </p>
    </header>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-5 rounded-2xl border border-border bg-white/5 p-4 text-accent">
        <Compass size={30} aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 max-w-md text-sm leading-6 text-muted">
        {children}
      </div>
    </div>
  );
}
export function SectionLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="panel group flex min-h-28 items-center justify-between gap-4 p-5 transition-colors hover:border-accent/50"
    >
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
      <ArrowUpRight
        className="shrink-0 text-muted group-hover:text-accent"
        size={20}
        aria-hidden="true"
      />
    </Link>
  );
}
