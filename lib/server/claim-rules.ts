import {
  WITHIN_POLICY,
  type ApiErrorCode,
  type ClaimStatus,
  type Grade,
  type PolicyRule,
} from "@/types/api";

/**
 * PS5 policy rules, applied on the server only (POST /api/claims).
 *   1. Expense date cannot be in the future.
 *   2. Expenses older than 60 days cannot be claimed (exactly 60 days is allowed).
 *   3. Amount above the grade's max_amount for the category -> saved as 'flagged' with the reason.
 *      At or below max_amount -> saved as 'submitted', "Within policy".
 *
 * "Today" is the calendar date in India (Asia/Kolkata). Dates are compared as
 * whole calendar days, never as timestamps.
 *
 * Pure functions with no I/O, so they can be tested directly.
 * Contract: docs/api-contract.md, "Policy decision".
 */

export const MAX_EXPENSE_AGE_DAYS = 60;
const POLICY_TIME_ZONE = "Asia/Kolkata";

/** Today's date as "YYYY-MM-DD" in India. */
export function todayInIndia(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: POLICY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** True for a real calendar date written as "YYYY-MM-DD" (so not 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtcDay(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"). Negative if `from` is later. */
export function daysBetween(from: string, to: string): number {
  return toUtcDay(to) - toUtcDay(from);
}

export type RuleRejection = { ok: false; code: ApiErrorCode; message: string };

/** Rules 1 and 2. Returns a rejection, or null if the date is allowed. */
export function checkExpenseDate(expenseDate: string, today: string): RuleRejection | null {
  const age = daysBetween(expenseDate, today);
  if (age < 0) {
    return { ok: false, code: "FUTURE_DATE", message: "Expense date cannot be in the future." };
  }
  if (age > MAX_EXPENSE_AGE_DAYS) {
    return {
      ok: false,
      code: "EXPENSE_TOO_OLD",
      message: `Expenses older than ${MAX_EXPENSE_AGE_DAYS} days cannot be claimed.`,
    };
  }
  return null;
}

export type AmountDecision = { status: ClaimStatus; policy_check: string };

/** Rule 3. Matches the wording used in the seed data. */
export function checkAmount(amount: number, grade: Grade, rule: PolicyRule): AmountDecision {
  if (amount > rule.max_amount) {
    return {
      status: "flagged",
      policy_check: `Above ${grade} limit of ${rule.max_amount} for ${rule.category}`,
    };
  }
  return { status: "submitted", policy_check: WITHIN_POLICY };
}

// ---------------------------------------------------------------------------
// Policy decision: the single result claim creation uses.
// ---------------------------------------------------------------------------

export type PolicyInput = {
  category: string;
  amount: number;
  /** "YYYY-MM-DD" */
  expense_date: string;
};

export type PolicyContext = {
  /** The signed-in employee's grade, read from the employees table. */
  grade: Grade;
  /** The policy_rules row for (category, grade), or null if none exists. */
  rule: PolicyRule | null;
  /** Today in India as "YYYY-MM-DD" (see todayInIndia). */
  today: string;
};

export type PolicyDecision =
  /** The claim may be saved with this status and reason. */
  | {
      allowed: true;
      status: Extract<ClaimStatus, "submitted" | "flagged">;
      /** The max_amount that was applied, in rupees. */
      limit: number;
      /** Saved as claims.policy_check. */
      reason: string;
    }
  /** The claim must not be saved. */
  | {
      allowed: false;
      code: Extract<ApiErrorCode, "VALIDATION_ERROR" | "FUTURE_DATE" | "EXPENSE_TOO_OLD" | "UNKNOWN_CATEGORY">;
      reason: string;
    };

/**
 * Decides whether a claim may be saved and with which status.
 * Checks run in a fixed order and stop at the first refusal:
 * input sanity, date (future, then older than 60 days), matching rule, amount.
 * Never guesses: missing or mismatched data is refused, not defaulted.
 */
export function evaluateClaimPolicy(input: PolicyInput, context: PolicyContext): PolicyDecision {
  const { amount, expense_date, category } = input;
  const { grade, rule, today } = context;

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return { allowed: false, code: "VALIDATION_ERROR", reason: "Amount must be a number above 0." };
  }
  if (!isValidIsoDate(expense_date)) {
    return { allowed: false, code: "VALIDATION_ERROR", reason: "Expense date must be a real date (YYYY-MM-DD)." };
  }
  if (!isValidIsoDate(today)) {
    throw new Error(`Policy check needs today's date as YYYY-MM-DD, got "${today}".`);
  }

  const dateRejection = checkExpenseDate(expense_date, today);
  if (dateRejection) {
    return {
      allowed: false,
      code: dateRejection.code as "FUTURE_DATE" | "EXPENSE_TOO_OLD",
      reason: dateRejection.message,
    };
  }

  if (!rule || rule.category !== category || rule.grade !== grade) {
    return {
      allowed: false,
      code: "UNKNOWN_CATEGORY",
      reason: `No ${grade} policy exists for category ${category}.`,
    };
  }

  const amountDecision = checkAmount(amount, grade, rule);
  return {
    allowed: true,
    status: amountDecision.status === "flagged" ? "flagged" : "submitted",
    limit: rule.max_amount,
    reason: amountDecision.policy_check,
  };
}
