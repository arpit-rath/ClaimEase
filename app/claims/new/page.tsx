import type { Metadata } from "next";
import { Zap } from "lucide-react";
import NewClaimView from "@/components/claim/NewClaimView";
import PolicyHighlightsPanel from "@/components/claim/PolicyHighlightsPanel";
import RecentClaimsPanel from "@/components/claim/RecentClaimsPanel";

export const metadata: Metadata = {
  title: "New Claim",
};

export default function NewClaimPage() {
  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-8">
      <section className="flex flex-col gap-6">
        <header>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            <Zap className="h-4 w-4" aria-hidden="true" />
            Plain-language expense filing
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">New claim</h1>
          <p className="mt-3 max-w-3xl text-lg text-muted">
            Describe what you spent in your own words. ClaimEase picks out the amount, date and
            category, and you review everything before it&apos;s filed.
          </p>
        </header>
        <NewClaimView />
      </section>

      <aside className="flex flex-col gap-6" aria-label="Claim overview">
        <RecentClaimsPanel />
        <PolicyHighlightsPanel />
      </aside>
    </div>
  );
}
