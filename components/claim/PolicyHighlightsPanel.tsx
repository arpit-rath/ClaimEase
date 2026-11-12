"use client";

import { Info, RotateCw } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { getCategories } from "@/lib/api-client";
import { demoUser } from "@/lib/demo-user";
import { formatInr } from "@/lib/format";
import { categoryLabel } from "@/lib/labels";
import { describeFailure, useApiQuery } from "@/lib/use-api";

export default function PolicyHighlightsPanel() {
  const { state, reload } = useApiQuery(getCategories);
  const grade = state.status === "success" ? (state.data.categories[0]?.grade ?? demoUser.grade) : demoUser.grade;

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Info className="h-4 w-4 text-accent" aria-hidden="true" />
        Policy limits · Grade {grade}
      </h2>

      {state.status === "loading" && (
        <div className="mt-4 space-y-2.5" aria-label="Loading policy limits">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="block h-3.5 animate-pulse rounded bg-surface-3" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-4 flex flex-col items-start gap-3 text-sm" role="alert">
          <p className="text-danger">{describeFailure(state.failure)}</p>
          <Button size="sm" variant="secondary" onClick={reload}>
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
          </Button>
        </div>
      )}

      {state.status === "success" && (
        <dl className="mt-3 divide-y divide-border text-sm">
          {state.data.categories.map((rule) => (
            <div key={rule.category} className="flex items-baseline justify-between gap-3 py-2" title={rule.notes}>
              <dt className="text-muted">{categoryLabel(rule.category)}</dt>
              <dd className="font-mono font-medium">up to {formatInr(rule.max_amount)}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
        Claims above a limit are saved and flagged for review. Expenses older than 60 days can&apos;t be
        submitted.
      </p>
    </Card>
  );
}
