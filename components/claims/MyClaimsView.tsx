"use client";

import { useState } from "react";
import Link from "next/link";
import { ReceiptText, RotateCw } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Button, { buttonClasses } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { CLAIMS_CHANGED_EVENT, getClaims } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTimeIndia, formatInr } from "@/lib/format";
import { categoryLabel, STATUS_META } from "@/lib/labels";
import { describeFailure, useApiQuery } from "@/lib/use-api";
import type { Claim, ClaimStatus } from "@/types/api";

type Filter = "all" | "awaiting" | ClaimStatus;

/** Claims finance hasn't decided yet. */
const AWAITING: ClaimStatus[] = ["submitted", "flagged"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "awaiting", label: "Awaiting review" },
  { value: "flagged", label: "Flagged" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
];

function matches(claim: Claim, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "awaiting") return AWAITING.includes(claim.status);
  return claim.status === filter;
}

export default function MyClaimsView() {
  const { state, reload } = useApiQuery(getClaims, CLAIMS_CHANGED_EVENT);
  const [filter, setFilter] = useState<Filter>("all");

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-label="Loading your claims">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Alert
        tone="danger"
        title="Couldn't load your claims"
        action={
          <Button size="sm" variant="secondary" onClick={reload}>
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
          </Button>
        }
      >
        {describeFailure(state.failure)}
      </Alert>
    );
  }

  const claims = state.data.claims;

  if (claims.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ReceiptText className="h-6 w-6" aria-hidden="true" />}
          title="No claims yet"
          description="Claims you submit will show here with their status."
          action={
            <Link href="/claims/new" className={buttonClasses()}>
              Submit your first claim
            </Link>
          }
        />
      </Card>
    );
  }

  const count = (f: Filter) => claims.filter((c) => matches(c, f)).length;
  const sum = (f: Filter) => claims.filter((c) => matches(c, f)).reduce((t, c) => t + c.amount, 0);
  const shown = claims.filter((c) => matches(c, filter));

  const tiles: { filter: Filter; label: string; value: number; amount: number; tone: string }[] = [
    { filter: "awaiting", label: "Awaiting review", value: count("awaiting"), amount: sum("awaiting"), tone: "text-accent" },
    { filter: "flagged", label: "Flagged", value: count("flagged"), amount: sum("flagged"), tone: "text-warning" },
    { filter: "approved", label: "Approved", value: count("approved"), amount: sum("approved"), tone: "text-info" },
    { filter: "paid", label: "Paid", value: count("paid"), amount: sum("paid"), tone: "text-foreground" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Summary: each tile also filters the list */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.filter}
            type="button"
            onClick={() => setFilter(t.filter)}
            aria-pressed={filter === t.filter}
            className={cn(
              "rounded-2xl border bg-surface p-4 text-left transition-colors hover:border-accent/50",
              filter === t.filter ? "border-accent/60 ring-1 ring-accent/30" : "border-border",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t.label}</p>
            <p className={cn("mt-1 font-mono text-3xl font-semibold", t.tone)}>{t.value}</p>
            <p className="font-mono text-xs text-muted">{formatInr(t.amount)}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter claims by status"
          className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface-2 p-1"
        >
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.value
                  ? "bg-accent-soft text-accent ring-1 ring-accent/40"
                  : "text-muted hover:text-foreground",
              )}
            >
              {f.label} <span className="ml-0.5 font-mono text-xs">{count(f.value)}</span>
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={reload}>
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
        </Button>
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState title="No claims with this status" description="Choose another filter to see your other claims." />
        </Card>
      ) : (
        <>
          {/* Desktop: table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Your claims, newest first</caption>
              <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
                  <th scope="col" className="px-4 py-3 font-medium">Expense date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Category · description</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Policy check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((c) => (
                  <tr key={c.id} className={cn(c.status === "flagged" && "bg-warning/[.04]")}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {formatDateTimeIndia(c.created_at)}
                      <div className="font-mono text-xs">#{c.id}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">{formatDate(c.expense_date)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{categoryLabel(c.category)}</div>
                      <div className="text-muted">{c.description}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-semibold">
                      {formatInr(c.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className={cn("px-4 py-3", c.status === "flagged" ? "text-warning" : "text-muted")}>
                      {c.policy_check ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Phone: cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {shown.map((c) => (
              <li key={c.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{categoryLabel(c.category)}</p>
                      <p className="text-sm text-muted">{c.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono font-semibold">{formatInr(c.amount)}</p>
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted">Expense date</dt>
                      <dd className="font-mono">{formatDate(c.expense_date)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Submitted</dt>
                      <dd>{formatDateTimeIndia(c.created_at)}</dd>
                    </div>
                  </dl>
                  {c.policy_check && (
                    <p
                      className={cn(
                        "mt-3 rounded-lg border px-3 py-2 text-xs",
                        c.status === "flagged"
                          ? "border-warning/30 bg-warning/10 text-warning"
                          : "border-border bg-surface-2 text-muted",
                      )}
                    >
                      Policy check: {c.policy_check}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ClaimStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-block whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium", meta.badge)}>
      {meta.label}
    </span>
  );
}
