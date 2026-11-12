/**
 * Shared API request/response formats (Members 1 + 2).
 * Human-readable version: docs/api-contract.md.
 *
 * Safe to import from client components: no server code, no secrets.
 * Field names follow the database (snake_case). Amounts are rupees.
 * Dates are "YYYY-MM-DD".
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums (values match the CHECK constraints and seed rows in supabase/migrations)
// ---------------------------------------------------------------------------

export const GRADES = ["L1", "L2", "L3"] as const;
export const GradeSchema = z.enum(GRADES);
export type Grade = z.infer<typeof GradeSchema>;

export const CLAIM_STATUSES = ["submitted", "flagged", "approved", "rejected", "paid"] as const;
export const ClaimStatusSchema = z.enum(CLAIM_STATUSES);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

/** Categories present in policy_rules. */
export const CLAIM_CATEGORIES = [
  "local_travel",
  "outstation_travel",
  "hotel_metro",
  "hotel_non_metro",
  "meals",
  "client_entertainment",
  "internet",
  "mobile",
  "training",
] as const;
export const ClaimCategorySchema = z.enum(CLAIM_CATEGORIES);
export type ClaimCategory = z.infer<typeof ClaimCategorySchema>;

/** policy_check text saved for claims that pass every rule. */
export const WITHIN_POLICY = "Within policy";

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/** employees row. GET /api/me */
export const EmployeeSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  grade: GradeSchema,
  department: z.string(),
  manager_name: z.string(),
  base_city: z.string(),
});
export type Employee = z.infer<typeof EmployeeSchema>;

/** policy_rules row for the signed-in employee's grade. GET /api/categories */
export const PolicyRuleSchema = z.object({
  category: ClaimCategorySchema,
  grade: GradeSchema,
  max_amount: z.number(),
  receipt_required_above: z.number(),
  notes: z.string(),
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

/** claims row. GET /api/claims, POST /api/claims */
export const ClaimSchema = z.object({
  id: z.number(),
  employee_id: z.string(),
  category: z.string(),
  amount: z.number(),
  expense_date: z.iso.date(),
  description: z.string(),
  has_receipt: z.boolean(),
  status: ClaimStatusSchema,
  policy_check: z.string().nullable(),
  created_at: z.string(),
});
export type Claim = z.infer<typeof ClaimSchema>;

/** Minimal employee context returned with claims in the Finance Review queue. */
export const FinanceReviewEmployeeSchema = EmployeeSchema.pick({
  id: true,
  name: true,
  grade: true,
  department: true,
  manager_name: true,
  base_city: true,
});
export type FinanceReviewEmployee = z.infer<typeof FinanceReviewEmployeeSchema>;

export const FinanceReviewClaimSchema = ClaimSchema.extend({
  employee: FinanceReviewEmployeeSchema,
});
export type FinanceReviewClaim = z.infer<typeof FinanceReviewClaimSchema>;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** POST /api/claims body. employee_id and status are decided by the server. */
export const CreateClaimRequestSchema = z.strictObject({
  category: ClaimCategorySchema,
  amount: z
    .number()
    .positive()
    .max(99_999_999.99)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "At most 2 decimal places"),
  expense_date: z.iso.date(),
  description: z.string().trim().min(1).max(500),
  has_receipt: z.boolean().default(false),
});
export type CreateClaimRequest = z.input<typeof CreateClaimRequestSchema>;

/**
 * Claim details gathered so far in the New Claim chat. Every field may be
 * unknown (null). This is a suggestion only: nothing is saved until the
 * employee confirms and POST /api/claims accepts it.
 */
export const ClaimDraftSchema = z.object({
  category: ClaimCategorySchema.nullable(),
  amount: z.number().positive().nullable(),
  expense_date: z.iso.date().nullable(),
  description: z.string().max(500).nullable(),
  has_receipt: z.boolean().nullable(),
});
export type ClaimDraft = z.infer<typeof ClaimDraftSchema>;

/** Fields a draft needs before it can be submitted. */
export const REQUIRED_DRAFT_FIELDS = ["amount", "expense_date", "category", "description"] as const;
export type RequiredDraftField = (typeof REQUIRED_DRAFT_FIELDS)[number];

/** POST /api/extract body. */
export const ExtractRequestSchema = z.strictObject({
  /** What the employee typed. */
  message: z.string().trim().min(1).max(1000),
  /** Details from earlier in the conversation, so a follow-up answer fills the gaps. */
  draft: ClaimDraftSchema.optional(),
});
export type ExtractRequest = z.input<typeof ExtractRequestSchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export type MeResponse = { employee: Employee };
export type CategoriesResponse = { categories: PolicyRule[] };
export type ClaimsListResponse = { claims: Claim[] };
export type FinanceClaimsListResponse = { claims: FinanceReviewClaim[] };
export type FinanceClaimReviewResponse = { claim: Claim };
export type CreateClaimResponse = { claim: Claim };
export type ExtractResponse = {
  /** Merged details: earlier draft plus anything new in this message. */
  draft: ClaimDraft;
  /** Required fields still unknown. */
  missing: RequiredDraftField[];
  /** The assistant's chat reply (a follow-up question when something is missing). */
  reply: string;
};

export const API_ERROR_CODES = [
  "VALIDATION_ERROR", // 400: body is not valid JSON or fails the schema
  "UNKNOWN_CATEGORY", // 422: no policy rule for this category and grade
  "FUTURE_DATE", // 422: expense_date is after today
  "EXPENSE_TOO_OLD", // 422: expense_date is more than 60 days ago
  "UNAUTHORIZED", // 401: no valid Supabase session or bearer token
  "FORBIDDEN", // 403: authenticated user lacks required authorization
  "CLAIM_NOT_REVIEWABLE", // 409: claim is not awaiting finance review
  "NOT_FOUND", // 404
  "AI_UNAVAILABLE", // 503: the assistant could not be reached or gave an unusable answer
  "SERVER_ERROR", // 500
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Per-field messages, only for VALIDATION_ERROR. */
    fields?: Record<string, string[]>;
  };
};
