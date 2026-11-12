"use client";

import { useId, useState } from "react";
import { Check, Info, Pencil, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import { formatDate, formatInrExact } from "@/lib/format";

export type ReviewDetails = {
  amount: number;
  expenseDate: string;
  description: string;
  category: string;
};

type ReviewCardProps = {
  initial: ReviewDetails;
  categories: readonly string[];
};

const fieldBox = "rounded-xl border border-border bg-surface-2 px-4 py-3";
const fieldLabel = "text-xs text-muted";
const inputClass =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-accent focus:outline-none";

export default function ReviewCard({ initial, categories }: ReviewCardProps) {
  const [details, setDetails] = useState(initial);
  const [editing, setEditing] = useState(false);
  const id = useId();

  const update = <K extends keyof ReviewDetails>(key: K, value: ReviewDetails[K]) =>
    setDetails((d) => ({ ...d, [key]: value }));

  return (
    <section
      aria-label="Claim details to review"
      className="rounded-2xl border border-accent/25 bg-linear-to-b from-accent/[.06] to-transparent p-5 sm:p-6"
    >
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Total claim amount</p>
          {editing ? (
            <label className="mt-2 block">
              <span className="sr-only">Amount in rupees</span>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={Number.isNaN(details.amount) ? "" : details.amount}
                onChange={(e) => update("amount", e.target.valueAsNumber)}
                className={`${inputClass} max-w-48 font-mono text-2xl`}
              />
            </label>
          ) : (
            <p className="mt-1 font-mono text-4xl font-semibold tracking-tight text-accent sm:text-5xl">
              {Number.isNaN(details.amount) ? "—" : formatInrExact(details.amount)}
              <span className="ml-2 font-sans text-sm font-normal text-muted">INR</span>
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-sm text-accent">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          AI suggestion · please check
        </span>
      </div>

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
            <select
              id={`${id}-category`}
              value={details.category}
              onChange={(e) => update("category", e.target.value)}
              className={inputClass}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 text-lg font-semibold">{details.category}</p>
          )}
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
              value={details.expenseDate}
              onChange={(e) => update("expenseDate", e.target.value)}
              className={inputClass}
            />
          ) : (
            <p className="mt-1 font-mono text-lg font-semibold">
              {details.expenseDate ? formatDate(details.expenseDate) : "—"}
            </p>
          )}
        </div>

        <div className={`${fieldBox} sm:col-span-2`}>
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
              value={details.description}
              onChange={(e) => update("description", e.target.value)}
              className={inputClass}
            />
          ) : (
            <p className="mt-1 text-lg font-semibold">{details.description || "—"}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium">Policy check happens when you submit</p>
          <p className="text-muted">
            You&apos;ll see whether the claim was submitted, flagged with a reason, or blocked because
            it&apos;s older than 60 days.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="secondary" onClick={() => setEditing((e) => !e)}>
          {editing ? <Check className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
          {editing ? "Done editing" : "Edit details"}
        </Button>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <Button disabled aria-describedby={`${id}-submit-note`}>
            <Check className="h-4 w-4" aria-hidden="true" />
            Confirm &amp; submit claim
          </Button>
          <p id={`${id}-submit-note`} className="text-xs text-muted">
            Enabled once the backend is connected
          </p>
        </div>
      </div>
    </section>
  );
}
