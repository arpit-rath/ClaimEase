"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, LogIn, RotateCw, ShieldAlert } from "lucide-react";
import ReviewClaimCard, { type ReviewDecision } from "@/components/finance/ReviewClaimCard";
import Alert from "@/components/ui/Alert";
import Button, { buttonClasses } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { CLAIMS_CHANGED_EVENT, getFinanceClaims } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatInr } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { describeFailure, useApiQuery } from "@/lib/use-api";

type Filter = "all" | "flagged" | "submitted";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All waiting" },
  { value: "flagged", label: "Flagged" },
  { value: "submitted", label: "Within policy" },
];

type Notice =
  | { kind: "decided"; decision: ReviewDecision }
  | { kind: "stale"; claimId: number };

export default function FinanceReviewView() {
  const { state, reload } = useApiQuery(getFinanceClaims);
  const [filter, setFilter] = useState<Filter>("all");
  const [decidedIds, setDecidedIds] = useState<number[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Reload when the reviewer signs in or out in this browser.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = getSupabaseBrowserClient().auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") reload();
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // Sign-in unavailable: the list request reports it.
    }
    return () => unsubscribe?.();
  }, [reload]);

  function handleDecided(decision: ReviewDecision) {
    setDecidedIds((ids) => [...ids, decision.claim.id]);
    setNotice({ kind: "decided", decision });
    window.dispatchEvent(new Event(CLAIMS_CHANGED_EVENT));
  }

  function handleStale(claimId: number) {
    setNotice({ kind: "stale", claimId });
    setDecidedIds([]);
    reload();
  }

  function retry() {
    setDecidedIds([]);
    reload();
  }

  return (
    <div className="flex flex-col gap-6">
      {notice && <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />}

      {state.status === "loading" && (
        <div className="flex flex-col gap-4" aria-label="Loading claims to review">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
        </div>
      )}

      {state.status === "error" && <AccessOrError failure={state.failure} onRetry={retry} />}

      {state.status === "success" && (
        <Queue
          claims={state.data.claims.filter((c) => !decidedIds.includes(c.id))}
          filter={filter}
          onFilter={setFilter}
          onDecided={handleDecided}
          onStale={handleStale}
          onRefresh={retry}
        />
      )}
    </div>
  );
}

function Queue({
  claims,
  filter,
  onFilter,
  onDecided,
  onStale,
  onRefresh,
}: {
  claims: Parameters<typeof ReviewClaimCard>[0]["claim"][];
  filter: Filter;
  onFilter: (f: Filter) => void;
  onDecided: (d: ReviewDecision) => void;
  onStale: (id: number) => void;
  onRefresh: () => void;
}) {
  const counts: Record<Filter, number> = {
    all: claims.length,
    flagged: claims.filter((c) => c.status === "flagged").length,
    submitted: claims.filter((c) => c.status === "submitted").length,
  };
  const shown = filter === "all" ? claims : claims.filter((c) => c.status === filter);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter claims" className="flex gap-1 rounded-xl border border-border bg-surface-2 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => onFilter(f.value)}
              className={cn(
                "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-4",
                filter === f.value
                  ? "bg-accent-soft text-accent ring-1 ring-accent/40"
                  : "text-muted hover:text-foreground",
              )}
            >
              {f.label} <span className="ml-1 font-mono text-xs">{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
        </Button>
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="h-6 w-6" aria-hidden="true" />}
            title={claims.length === 0 ? "Nothing waiting for review" : "No claims match this filter"}
            description={
              claims.length === 0
                ? "New claims will appear here once employees submit them."
                : "Choose another filter to see the remaining claims."
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {shown.map((claim) => (
            <ReviewClaimCard key={claim.id} claim={claim} onDecided={onDecided} onStale={onStale} />
          ))}
        </div>
      )}
    </>
  );
}

function AccessOrError({
  failure,
  onRetry,
}: {
  failure: Parameters<typeof describeFailure>[0];
  onRetry: () => void;
}) {
  const signIn = (
    <Link href="/login" className={buttonClasses()}>
      <LogIn className="h-4 w-4" aria-hidden="true" /> Sign in
    </Link>
  );

  if (failure.kind === "signed_out") {
    return (
      <Card>
        <EmptyState
          icon={<LogIn className="h-6 w-6" aria-hidden="true" />}
          title="Sign in to review claims"
          description="Finance Review is only for finance staff. Sign in with your finance account."
          action={signIn}
        />
      </Card>
    );
  }
  if (failure.kind === "api" && failure.code === "UNAUTHORIZED") {
    return (
      <Card>
        <EmptyState
          icon={<LogIn className="h-6 w-6" aria-hidden="true" />}
          title="Your session has ended"
          description="Sign in again to continue reviewing claims."
          action={signIn}
        />
      </Card>
    );
  }
  if (failure.kind === "api" && failure.code === "FORBIDDEN") {
    return (
      <Card>
        <EmptyState
          icon={<ShieldAlert className="h-6 w-6" aria-hidden="true" />}
          title="No finance access"
          description="You're signed in, but this account isn't an active finance reviewer. Ask an admin to add it to Finance Review."
        />
      </Card>
    );
  }
  return (
    <Alert
      tone="danger"
      title="Couldn't load claims to review"
      action={
        <Button size="sm" variant="secondary" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
        </Button>
      }
    >
      {describeFailure(failure)}
    </Alert>
  );
}

function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const dismiss = (
    <Button size="sm" variant="ghost" onClick={onDismiss}>
      Dismiss
    </Button>
  );

  if (notice.kind === "stale") {
    return (
      <Alert tone="info" title={`Claim #${notice.claimId} was already reviewed`} action={dismiss}>
        Someone else decided it first. The list has been refreshed.
      </Alert>
    );
  }

  const { claim, action, reason } = notice.decision;
  return (
    <Alert
      tone={action === "approve" ? "success" : "warning"}
      title={`Claim #${claim.id} ${action === "approve" ? "approved" : "rejected"}`}
      action={dismiss}
    >
      <p>
        {formatInr(claim.amount)} · status is now <span className="font-medium">{claim.status}</span>.
        {reason && (
          <>
            {" "}
            Reason: {reason}
          </>
        )}
      </p>
      <p className="mt-1">Recorded in the review log with your account and the time of the decision.</p>
    </Alert>
  );
}
