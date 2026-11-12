import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import MyClaimsView from "@/components/claims/MyClaimsView";
import { buttonClasses } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "My Claims",
};

export default function MyClaimsPage() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">My claims</h1>
          <p className="mt-2 text-lg text-muted">
            Everything you&apos;ve submitted, newest first. Claims awaiting review haven&apos;t been decided
            by finance yet.
          </p>
        </div>
        <Link href="/claims/new" className={buttonClasses({ className: "shrink-0" })}>
          <Plus className="h-4 w-4" aria-hidden="true" /> New claim
        </Link>
      </header>
      <MyClaimsView />
    </section>
  );
}
