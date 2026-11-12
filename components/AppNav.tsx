"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const links = [
  { href: "/claims/new", label: "New Claim" },
  { href: "/claims", label: "My Claims" },
];

export default function AppNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className={cn("flex gap-1 rounded-xl border border-border bg-surface-2 p-1", className)}
    >
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-colors sm:flex-none",
              active
                ? "bg-accent-soft text-accent ring-1 ring-accent/40"
                : "text-muted hover:text-foreground",
            )}
          >
            {active && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
