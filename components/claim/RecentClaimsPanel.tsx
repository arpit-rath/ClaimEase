"use client";

import Link from "next/link";
import { Clock, ReceiptText, RotateCw } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { CLAIMS_CHANGED_EVENT, getClaims } from "@/lib/api-client";
import { formatDate, formatInr } from "@/lib/format";
import { categoryLabel, STATUS_META } from "@/lib/labels";
import { describeFailure, useApiQuery } from "@/lib/use-api";

const SHOWN = 4;

export default function RecentClaimsPanel() {
  const { state, reload } = useApiQuery(getClaims, CLAIMS_CHANGED_EVENT);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Clock className="h-4 w-4 text-accent" aria-hidden="true" />
          Recent claims
        </h2>
        <Link href="/claims" className="text-sm font-medium text-accent hover:text-accent-hover">
          View all
        </Link>
      </div>

      {state.status === "loading" && (
        <ul className="mt-2 divide-y divide-border" aria-label="Loading recent claims">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 py-3">
              <span className="h-10 w-10 animate-pulse rounded-xl bg-surface-3" />
              <span className="flex-1 space-y-2">
                <span className="block h-3 w-3/4 animate-pulse rounded bg-surface-3" />
                <span className="block h-3 w-1/3 animate-pulse rounded bg-surface-3" />
              </span>
            </li>
          ))}
        </ul>
      )}

      {state.status === "error" && (
        <div className="mt-4 flex flex-col items-start gap-3 text-sm" role="alert">
          <p className="text-danger">{describeFailure(state.failure)}</p>
          <Button size="sm" variant="secondary" onClick={reload}>
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
          </Button>
        </div>
      )}

      {state.status === "success" && state.data.claims.length === 0 && (
        <p className="mt-4 text-sm text-muted">No claims yet. Your submitted claims will show here.</p>
      )}

      {state.status === "success" && state.data.claims.length > 0 && (
        <ul className="mt-2 divide-y divide-border">
          {state.data.claims.slice(0, SHOWN).map((c) => {
            const meta = STATUS_META[c.status];
            return (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-3 text-muted"
                >
                  <ReceiptText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={c.description}>
                    {c.description}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {categoryLabel(c.category)} · {formatDate(c.expense_date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold">{formatInr(c.amount)}</p>
                  <p className={cn("text-xs font-medium", meta.text)}>{meta.label}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
