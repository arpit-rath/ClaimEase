import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import FinanceReviewView from "@/components/finance/FinanceReviewView";

export const metadata: Metadata = {
  title: "Finance Review",
};

export default function FinanceReviewPage() {
  return (
    <section className="flex flex-col gap-6">
      <header>
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-accent">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Finance staff only
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Finance review</h1>
        <p className="mt-3 max-w-3xl text-lg text-muted">
          Claims waiting for a decision. Flagged claims went over their policy limit; check the reason
          before approving or rejecting.
        </p>
      </header>
      <FinanceReviewView />
    </section>
  );
}
