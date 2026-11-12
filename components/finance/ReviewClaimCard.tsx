"use client";

import { useId, useState } from "react";
import { Check, ReceiptText, X } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { approveClaim, rejectClaim, type ApiFailure } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTimeIndia, formatInr } from "@/lib/format";
import { categoryLabel, STATUS_META } from "@/lib/labels";
import { describeFailure } from "@/lib/use-api";
import type { Claim, FinanceReviewClaim } from "@/types/api";

export type ReviewDecision = { claim: Claim; action: "approve" | "reject"; reason: string | null };

type Mode = "idle" | "confirm-approve" | "reject";

type ReviewClaimCardProps = {
  claim: FinanceReviewClaim;
  /** Called only after the server confirms the decision. */
  onDecided: (decision: ReviewDecision) => void;
  /** Called when the server says the claim is no longer awaiting review. */
  onStale: (claimId: number) => void;
};

const REASON_MAX = 500;

export default function ReviewClaimCard({ claim, onDecided, onStale }: ReviewClaimCardProps) {
  const id = useId();
  const [mode, setMode] = useState<Mode>("idle");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const meta = STATUS_META[claim.status];
  const flagged = claim.status === "flagged";

  async function decide(action: "approve" | "reject") {
    if (busy) return;
    const trimmed = reason.trim();
    if (action === "reject" && trimmed === "") {
      setReasonError("Enter a reason for rejecting this claim.");
      return;
    }

    setBusy(true);
    setFailure(null);
    const result = action === "approve" ? await approveClaim(claim.id) : await rejectClaim(claim.id, trimmed);
    setBusy(false);

    if (result.ok) {
      onDecided({ claim: result.data.claim, action, reason: action === "reject" ? trimmed : null });
      return;
    }
    if (result.failure.kind === "api" && result.failure.code === "CLAIM_NOT_REVIEWABLE") {
      onStale(claim.id);
      return;
    }
    setFailure(result.failure);
  }

  return (
    <Card className="p-5">
      <article aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
        {/* Who and how much */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id={`${id}-title`} className="font-semibold">
              {claim.employee.name}
              <span className="ml-2 font-mono text-xs font-normal text-muted">
                {claim.employee.id} · {claim.employee.grade}
              </span>
            </h2>
            <p className="text-sm text-muted">
              {claim.employee.department} · Manager {claim.employee.manager_name}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-semibold">{formatInr(claim.amount)}</p>
            <span className={cn("inline-block rounded-md border px-2 py-0.5 text-xs font-medium", meta.badge)}>
              {meta.label}
            </span>
          </div>
        </div>

        {/* What */}
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Category</dt>
            <dd>{categoryLabel(claim.category)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Expense date</dt>
            <dd className="font-mono">{formatDate(claim.expense_date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Submitted</dt>
            <dd>{formatDateTimeIndia(claim.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Receipt</dt>
            <dd className="flex items-center gap-1.5">
              <ReceiptText className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
              {claim.has_receipt ? "Provided" : "Not provided"}
            </dd>
          </div>
          <div className="sm:col-span-4">
            <dt className="text-xs text-muted">Description</dt>
            <dd>{claim.description}</dd>
          </div>
        </dl>

        {/* Policy result saved by the server */}
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            flagged ? "border-warning/30 bg-warning/10 text-warning" : "border-border bg-surface-2 text-muted",
          )}
        >
          <span className="font-medium">Policy check:</span> {claim.policy_check ?? "No result recorded"}
        </p>

        {failure && (
          <Alert tone="danger" title="The decision wasn't saved">
            {describeFailure(failure)}
          </Alert>
        )}

        {/* Actions */}
        {mode === "idle" && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setMode("reject")}>
              <X className="h-4 w-4" aria-hidden="true" /> Reject
            </Button>
            <Button onClick={() => setMode("confirm-approve")}>
              <Check className="h-4 w-4" aria-hidden="true" /> Approve
            </Button>
          </div>
        )}

        {mode === "confirm-approve" && (
          <div className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent-soft p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              Approve claim #{claim.id} for {formatInr(claim.amount)}? This can&apos;t be undone here.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={busy} onClick={() => setMode("idle")}>
                Cancel
              </Button>
              <Button loading={busy} onClick={() => decide("approve")}>
                Confirm approval
              </Button>
            </div>
          </div>
        )}

        {mode === "reject" && (
          <form
            className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void decide("reject");
            }}
          >
            <label htmlFor={`${id}-reason`} className="text-sm font-medium">
              Reason for rejecting claim #{claim.id}
            </label>
            <textarea
              id={`${id}-reason`}
              rows={3}
              maxLength={REASON_MAX}
              value={reason}
              disabled={busy}
              aria-invalid={Boolean(reasonError)}
              aria-describedby={reasonError ? `${id}-reason-error` : undefined}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError(null);
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              placeholder="e.g. Business purpose missing; resubmit with the client name"
            />
            {reasonError && (
              <p id={`${id}-reason-error`} className="text-sm text-danger">
                {reasonError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setMode("idle");
                  setReasonError(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Confirm rejection
              </Button>
            </div>
          </form>
        )}
      </article>
    </Card>
  );
}
