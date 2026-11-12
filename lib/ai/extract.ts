/**
 * Expense extraction for the New Claim chat.
 *
 * The AI only suggests details and writes the chat reply. Everything it
 * returns is checked here (known category for the grade, positive amount, real
 * date) and the result is a draft the employee must confirm. Policy decisions
 * are made later, on submit, by lib/server/claim-rules.ts.
 *
 * Pure functions (no network), so they can be tested directly.
 */
import { isValidIsoDate } from "@/lib/server/claim-rules";
import {
  REQUIRED_DRAFT_FIELDS,
  type ClaimCategory,
  type ClaimDraft,
  type ExtractResponse,
  type Grade,
  type PolicyRule,
  type RequiredDraftField,
} from "@/types/api";

export const EMPTY_DRAFT: ClaimDraft = {
  category: null,
  amount: null,
  expense_date: null,
  description: null,
  has_receipt: null,
};

const QUESTIONS: Record<RequiredDraftField, string> = {
  amount: "How much did you spend, in rupees?",
  expense_date: "What date was the expense?",
  category: "What kind of expense was it (for example meals, local travel or a hotel)?",
  description: "What was it for? A short description is enough.",
};

const READY_REPLY = "Here's what I understood. Check the details, correct anything that's wrong, then confirm to submit.";

/** JSON Schema the model must answer with. Category is limited to the grade's rules. */
export function extractionSchema(categories: readonly string[]): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      amount: { type: ["number", "null"], description: "Amount in rupees, e.g. 2400 for ₹2,400." },
      expense_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
      category: { type: ["string", "null"], enum: [...categories, null] },
      description: { type: ["string", "null"], description: "Short business description." },
      has_receipt: { type: ["boolean", "null"] },
      reply: { type: "string", description: "One or two short sentences to the employee." },
    },
    required: ["amount", "expense_date", "category", "description", "has_receipt", "reply"],
  };
}

export function buildExtractionPrompt(input: {
  message: string;
  today: string;
  grade: Grade;
  rules: readonly PolicyRule[];
  draft: ClaimDraft;
}): { system: string; user: string } {
  const categoryLines = input.rules.map((r) => `- ${r.category}: ${r.notes}`).join("\n");
  const system = [
    "You help an employee file a work expense claim. Read their message and fill in the claim details.",
    `Today's date is ${input.today} (India time). Turn relative dates such as "yesterday" or "last Friday" into YYYY-MM-DD. Use null if no date was given.`,
    "amount: the rupee amount as a number (₹2,400 means 2400). Use null if no amount was given. Never guess an amount.",
    "category: the single best code from this list, or null if it is unclear:",
    categoryLines,
    "description: a short business description, for example \"Client dinner with Nexora Retail\". Use null if there is nothing to describe.",
    "has_receipt: true or false only if the employee said so; otherwise null.",
    `Details already collected in this conversation (keep them unless the new message changes them): ${JSON.stringify(input.draft)}`,
    "reply: one or two short, friendly sentences to the employee. If the amount, date, category or description is still unknown, ask for the missing detail in one question. Otherwise say the details are ready to review and confirm below; you may add one optional tip (for example, adding the client's name to the description), but do not ask a question.",
    "Never say whether the claim is within policy, flagged, approved or rejected. Never say it has been submitted, saved or recorded: nothing is saved until the employee confirms, and the system checks policy then.",
  ].join("\n");
  return { system, user: input.message };
}

function cleanAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 99_999_999.99) return null;
  return Math.round(value * 100) / 100;
}

function cleanDate(value: unknown): string | null {
  return typeof value === "string" && isValidIsoDate(value) ? value : null;
}

function cleanCategory(value: unknown, allowed: readonly string[]): ClaimCategory | null {
  return typeof value === "string" && allowed.includes(value) ? (value as ClaimCategory) : null;
}

function cleanDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 500);
  return trimmed === "" ? null : trimmed;
}

/**
 * Checks the model's answer field by field and merges it over the earlier
 * draft. Anything invalid is dropped (the earlier value is kept) rather than
 * guessed. Builds the reply, falling back to a fixed question when needed.
 */
export function finishExtraction(
  raw: unknown,
  context: { allowedCategories: readonly string[]; previous: ClaimDraft },
): ExtractResponse {
  const out = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const prev = context.previous;

  const draft: ClaimDraft = {
    amount: cleanAmount(out.amount) ?? prev.amount,
    expense_date: cleanDate(out.expense_date) ?? prev.expense_date,
    category: cleanCategory(out.category, context.allowedCategories) ?? prev.category,
    description: cleanDescription(out.description) ?? prev.description,
    has_receipt: typeof out.has_receipt === "boolean" ? out.has_receipt : prev.has_receipt,
  };

  const missing = REQUIRED_DRAFT_FIELDS.filter((field) => draft[field] === null);

  let reply = typeof out.reply === "string" ? out.reply.trim().slice(0, 400) : "";
  if (missing.length > 0 && !reply.includes("?")) reply = QUESTIONS[missing[0]];
  // With everything known, the next step is reviewing, not answering optional questions.
  if (missing.length === 0 && reply.includes("?")) reply = READY_REPLY;
  if (reply === "") reply = READY_REPLY;

  return { draft, missing, reply };
}
