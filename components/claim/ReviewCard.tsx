"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { Check, Info, Pencil, Plus, RotateCw } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Button, { buttonClasses } from "@/components/ui/Button";
import ExampleTag from "@/components/ui/ExampleTag";
import { cn } from "@/lib/cn";
import { CLAIMS_CHANGED_EVENT, createClaim, getCategories, type ApiFailure } from "@/lib/api-client";
import { formatDate, formatInr, formatInrExact } from "@/lib/format";
import { categoryLabel, STATUS_META } from "@/lib/labels";
import { describeFailure, useApiQuery } from "@/lib/use-api";
import { CreateClaimRequestSchema, type Claim, type CreateClaimRequest } from "@/types/api";

export type ClaimDraft = {
  category: string;
  /** Kept as typed so the field can be empty or mid-edit. */
  amount: string;
  expense_date: string;
  description: string;
  has_receipt: boolean;
};

type Outcome =
  /** Backend saved the claim (201). */
  | { kind: "saved"; claim: Claim }
  /** Backend refused the claim on purpose (4xx). Nothing was saved. */
  | { kind: "rejected"; failure: Extract<ApiFailure, { kind: "api" }> }
  /** Details are missing or badly formatted (checked here, or 400 from the backend). */
  | { kind: "invalid"; fields: Record<string, string[]> }
  /** No usable answer from the backend (offline, 5xx, unexpected). Safe to retry. */
  | { kind: "failed"; failure: ApiFailure };

const FIELD_LABELS: Record<string, string> = {
  category: "Category",
  amount: "Amount",
  expense_date: "Expense date",
  description: "Description",
  has_receipt: "Receipt",
  _root: "Claim",
};

// Format-only checks, worded for people. Policy rules are left to the backend.
const FRIENDLY_FIELD_MESSAGES: Record<string, string> = {
  category: "Choose a category.",
  amount: "Enter an amount above ₹0 with at most 2 decimal places.",
  expense_date: "Choose the date of the expense.",
  description: "Add a short description (up to 500 characters).",
};

const REJECTION_TITLES: Partial<Record<string, string>> = {
  EXPENSE_TOO_OLD: "Not submitted: this expense is older than 60 days",
  FUTURE_DATE: "Not submitted: the expense date is in the future",
  UNKNOWN_CATEGORY: "Not submitted: no policy exists for this category",
};

const fieldBox = "rounded-xl border border-border bg-surface-2 px-4 py-3";
const fieldLabel = "text-xs text-muted";
const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-accent focus:outline-none disabled:opacity-60";

function validate(draft: ClaimDraft) {
  const parsed = CreateClaimRequestSchema.safeParse({
    category: draft.category,
    amount: draft.amount.trim() === "" ? Number.NaN : Number(draft.amount),
    expense_date: draft.expense_date,
    description: draft.description,
    has_receipt: draft.has_receipt,
  });
  if (parsed.success) return { ok: true as const, body: parsed.data satisfies CreateClaimRequest };

  const { fieldErrors } = z.flattenError(parsed.error);
  const fields: Record<string, string[]> = {};
  for (const key of Object.keys(fieldErrors)) {
    fields[key] = [FRIENDLY_FIELD_MESSAGES[key] ?? "Check this field."];
  }
  return { ok: false as const, fields };
}

type ReviewCardProps = {
  initialDraft: ClaimDraft;
  /** True while the details are the example prefill rather than the assistant's extraction. */
  isExample?: boolean;
  /** Blank form used by "Start a new claim". */
  blankDraft: ClaimDraft;
};

export default function ReviewCard({ initialDraft, blankDraft, isExample = false }: ReviewCardProps) {
  const id = useId();
  const categories = useApiQuery(getCategories);

  const [draft, setDraft] = useState(initialDraft);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [showExampleTag, setShowExampleTag] = useState(isExample);

  const saved = outcome?.kind === "saved";
  const locked = submitting || saved;
  const fieldErrors = outcome?.kind === "invalid" ? outcome.fields : {};

  const update = <K extends keyof ClaimDraft>(key: K, value: ClaimDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setShowExampleTag(false);
  };

  const rules = categories.state.status === "success" ? categories.state.data.categories : [];
  const selectedRule = rules.find((r) => r.category === draft.category);
  const amountNumber = Number(draft.amount);
  const amountIsValid = draft.amount.trim() !== "" && Number.isFinite(amountNumber);

  async function submit() {
    if (submitting) return;
    const checked = validate(draft);
    if (!checked.ok) {
      setOutcome({ kind: "invalid", fields: checked.fields });
      setEditing(true);
      return;
    }

    setSubmitting(true);
    setOutcome(null);
    const result = await createClaim(checked.body);
    setSubmitting(false);

    if (result.ok) {
      setOutcome({ kind: "saved", claim: result.data.claim });
      setEditing(false);
      window.dispatchEvent(new Event(CLAIMS_CHANGED_EVENT));
      return;
    }

    const failure = result.failure;
    if (failure.kind === "api" && failure.code === "VALIDATION_ERROR") {
      setOutcome({ kind: "invalid", fields: failure.fields ?? { _root: [failure.message] } });
      setEditing(true);
    } else if (failure.kind === "api" && failure.status < 500) {
      setOutcome({ kind: "rejected", failure });
    } else {
      setOutcome({ kind: "failed", failure });
    }
  }

  function startNewClaim() {
    setDraft(blankDraft);
    setOutcome(null);
    setEditing(true);
    setShowExampleTag(false);
  }

  return (
    <section
      aria-label="Claim details to review"
      className="rounded-2xl border border-accent/25 bg-linear-to-b from-accent/[.06] to-transparent p-5 sm:p-6"
    >
      {/* Amount */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Total claim amount</p>
          {editing ? (
            <label className="mt-2 block">
              <span className="sr-only">Amount in rupees</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-2xl text-muted">₹</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  aria-label="Amount in rupees"
                  value={draft.amount}
                  disabled={locked}
                  aria-invalid={Boolean(fieldErrors.amount)}
                  onChange={(e) => update("amount", e.target.value)}
                  className={cn(inputClass, "mt-0 max-w-52 font-mono text-2xl")}
                />
              </span>
            </label>
          ) : (
            <p className="mt-1 font-mono text-4xl font-semibold tracking-tight text-accent sm:text-5xl">
              {amountIsValid ? formatInrExact(amountNumber) : "—"}
              <span className="ml-2 font-sans text-sm font-normal text-muted">INR</span>
            </p>
          )}
          <FieldError messages={fieldErrors.amount} />
        </div>
        {showExampleTag && <ExampleTag label="Example values" className="self-start" />}
      </div>

      {/* Category, date, description */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className={fieldBox}>
          {editing ? (
            <label htmlFor={`${id}-category`} className={fieldLabel}>
              Expense category
            </label>
          ) : (
            <p className={fieldLabel}>Expense category</p>
          )}
          {editing ? (
            categories.state.status === "error" ? (
              <div className="mt-1 flex items-center justify-between gap-2 text-sm text-danger">
                Couldn&apos;t load categories.
                <Button size="sm" variant="secondary" onClick={categories.reload}>
                  <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
                </Button>
              </div>
            ) : (
              <select
                id={`${id}-category`}
                value={draft.category}
                disabled={locked || categories.state.status === "loading"}
                aria-invalid={Boolean(fieldErrors.category)}
                onChange={(e) => update("category", e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  {categories.state.status === "loading" ? "Loading categories…" : "Choose a category"}
                </option>
                {rules.map((r) => (
                  <option key={r.category} value={r.category}>
                    {categoryLabel(r.category)}
                  </option>
                ))}
              </select>
            )
          ) : (
            <p className="mt-1 text-lg font-semibold">
              {draft.category ? categoryLabel(draft.category) : "Not chosen yet"}
            </p>
          )}
          {selectedRule && (
            <p className="mt-1.5 text-xs text-muted">
              {selectedRule.grade} limit {formatInr(selectedRule.max_amount)} · {selectedRule.notes}
            </p>
          )}
          <FieldError messages={fieldErrors.category} />
        </div>

        <div className={fieldBox}>
          {editing ? (
            <label htmlFor={`${id}-date`} className={fieldLabel}>
              Expense date
            </label>
          ) : (
            <p className={fieldLabel}>Expense date</p>
          )}
          {editing ? (
            <input
              id={`${id}-date`}
              type="date"
              value={draft.expense_date}
              disabled={locked}
              aria-invalid={Boolean(fieldErrors.expense_date)}
              onChange={(e) => update("expense_date", e.target.value)}
              className={inputClass}
            />
          ) : (
            <p className="mt-1 font-mono text-lg font-semibold">
              {draft.expense_date ? formatDate(draft.expense_date) : "—"}
            </p>
          )}
          <FieldError messages={fieldErrors.expense_date} />
        </div>

        <div className={cn(fieldBox, "sm:col-span-2")}>
          {editing ? (
            <label htmlFor={`${id}-description`} className={fieldLabel}>
              Description
            </label>
          ) : (
            <p className={fieldLabel}>Description</p>
          )}
          {editing ? (
            <input
              id={`${id}-description`}
              type="text"
              maxLength={500}
              value={draft.description}
              disabled={locked}
              aria-invalid={Boolean(fieldErrors.description)}
              onChange={(e) => update("description", e.target.value)}
              className={inputClass}
            />
          ) : (
            <p className="mt-1 text-lg font-semibold">{draft.description || "—"}</p>
          )}
          <FieldError messages={fieldErrors.description} />
        </div>

        <label className="flex items-center gap-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={draft.has_receipt}
            disabled={locked}
            onChange={(e) => update("has_receipt", e.target.checked)}
            className="h-4 w-4 accent-(--accent)"
          />
          I have a receipt for this expense
        </label>
      </div>

      {/* Result from the backend, or the note before submitting */}
      <div className="mt-4" aria-live="polite">
        {outcome ? (
          <OutcomeMessage outcome={outcome} onRetry={submit} retrying={submitting} />
        ) : (
          <div className="flex gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium">Policy check happens when you submit</p>
              <p className="text-muted">
                You&apos;ll see whether the claim was submitted, flagged with a reason, or not accepted
                (for example, if it&apos;s older than 60 days).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {saved ? (
          <>
            <Link href="/claims" className={buttonClasses({ variant: "secondary" })}>
              View in My Claims
            </Link>
            <Button onClick={startNewClaim}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Start a new claim
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" disabled={submitting} onClick={() => setEditing((e) => !e)}>
              {editing ? <Check className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
              {editing ? "Done editing" : "Edit details"}
            </Button>
            {outcome?.kind !== "failed" && (
              <Button loading={submitting} onClick={submit}>
                {!submitting && <Check className="h-4 w-4" aria-hidden="true" />}
                {submitting ? "Submitting…" : "Confirm & submit claim"}
              </Button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1.5 text-sm text-danger">{messages.join(" ")}</p>;
}

function OutcomeMessage({
  outcome,
  onRetry,
  retrying,
}: {
  outcome: Outcome;
  onRetry: () => void;
  retrying: boolean;
}) {
  switch (outcome.kind) {
    case "saved": {
      const { claim } = outcome;
      const meta = STATUS_META[claim.status];
      const summary = `Claim #${claim.id} · ${categoryLabel(claim.category)} · ${formatInr(claim.amount)} · ${formatDate(claim.expense_date)}`;
      if (claim.status === "flagged") {
        return (
          <Alert tone="warning" title="Claim saved and flagged for review">
            <p>
              <span className="font-medium text-foreground">Reason:</span> {claim.policy_check ?? "No reason given"}
            </p>
            <p className="mt-1">{summary}</p>
          </Alert>
        );
      }
      return (
        <Alert tone="success" title={`Claim ${meta.label.toLowerCase()}`}>
          <p>{claim.policy_check ?? meta.label}</p>
          <p className="mt-1">{summary}</p>
        </Alert>
      );
    }
    case "rejected":
      return (
        <Alert tone="danger" title={REJECTION_TITLES[outcome.failure.code] ?? "Not submitted"}>
          <p>{outcome.failure.message}</p>
          <p className="mt-1">Nothing was saved. Change the details and submit again.</p>
        </Alert>
      );
    case "invalid":
      return (
        <Alert tone="danger" title="Some details need fixing">
          <ul className="list-disc pl-5">
            {Object.entries(outcome.fields).map(([field, messages]) => (
              <li key={field}>
                {FIELD_LABELS[field] ?? field}: {messages.join(" ")}
              </li>
            ))}
          </ul>
        </Alert>
      );
    case "failed":
      return (
        <Alert
          tone="danger"
          title="Your claim wasn't confirmed"
          action={
            <Button size="sm" variant="secondary" loading={retrying} onClick={onRetry}>
              {!retrying && <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />}
              Retry
            </Button>
          }
        >
          <p>{describeFailure(outcome.failure)}</p>
          {outcome.failure.kind === "network" && (
            <p className="mt-1">
              If it keeps failing, check My Claims before retrying in case it went through.
            </p>
          )}
        </Alert>
      );
  }
}
