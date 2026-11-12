import { describe, expect, it } from "vitest";

import { buildExtractionPrompt, EMPTY_DRAFT, extractionSchema, finishExtraction } from "@/lib/ai/extract";
import type { PolicyRule } from "@/types/api";

const allowed = ["client_entertainment", "meals", "local_travel"];
const full = {
  amount: 2400,
  expense_date: "2026-11-11",
  category: "client_entertainment",
  description: "Client dinner",
  has_receipt: null,
  reply: "Here's what I found. Please review and confirm.",
};

describe("finishExtraction", () => {
  it("keeps valid fields and reports nothing missing", () => {
    expect(finishExtraction(full, { allowedCategories: allowed, previous: EMPTY_DRAFT })).toEqual({
      draft: {
        amount: 2400,
        expense_date: "2026-11-11",
        category: "client_entertainment",
        description: "Client dinner",
        has_receipt: null,
      },
      missing: [],
      reply: "Here's what I found. Please review and confirm.",
    });
  });

  it("drops a category that is not in the grade's rules instead of guessing", () => {
    const result = finishExtraction({ ...full, category: "luxury_spa" }, { allowedCategories: allowed, previous: EMPTY_DRAFT });
    expect(result.draft.category).toBeNull();
    expect(result.missing).toEqual(["category"]);
  });

  it.each([0, -50, Number.NaN, "2400", 1e12])("drops an invalid amount (%s)", (amount) => {
    const result = finishExtraction({ ...full, amount }, { allowedCategories: allowed, previous: EMPTY_DRAFT });
    expect(result.draft.amount).toBeNull();
    expect(result.missing).toContain("amount");
  });

  it("rounds an amount to paise", () => {
    expect(finishExtraction({ ...full, amount: 99.999 }, { allowedCategories: allowed, previous: EMPTY_DRAFT }).draft.amount).toBe(100);
  });

  it.each(["2026-02-30", "yesterday", "11/11/2026"])("drops an invalid date (%s)", (expense_date) => {
    const result = finishExtraction({ ...full, expense_date }, { allowedCategories: allowed, previous: EMPTY_DRAFT });
    expect(result.draft.expense_date).toBeNull();
  });

  it("keeps earlier details when the follow-up answer only adds the missing one", () => {
    const previous = { ...EMPTY_DRAFT, amount: 650, category: "local_travel" as const, description: "Cab to client" };
    const answer = { amount: null, expense_date: "2026-11-10", category: null, description: null, has_receipt: null, reply: "Thanks, all set." };
    expect(finishExtraction(answer, { allowedCategories: allowed, previous })).toMatchObject({
      draft: { amount: 650, expense_date: "2026-11-10", category: "local_travel", description: "Cab to client" },
      missing: [],
    });
  });

  it("lets a correction replace an earlier value", () => {
    const previous = { ...EMPTY_DRAFT, amount: 2400 };
    expect(finishExtraction({ ...full, amount: 2600 }, { allowedCategories: allowed, previous }).draft.amount).toBe(2600);
  });

  it("asks a fixed question when details are missing and the reply asks nothing", () => {
    const result = finishExtraction(
      { ...full, amount: null, reply: "Got it." },
      { allowedCategories: allowed, previous: EMPTY_DRAFT },
    );
    expect(result.reply).toBe("How much did you spend, in rupees?");
  });

  it("replaces an optional question with the review prompt when nothing is missing", () => {
    const result = finishExtraction(
      { ...full, reply: "Could you tell me the client's name?" },
      { allowedCategories: allowed, previous: EMPTY_DRAFT },
    );
    expect(result.missing).toEqual([]);
    expect(result.reply).toBe(
      "Here's what I understood. Check the details, correct anything that's wrong, then confirm to submit.",
    );
  });

  it("survives a completely unusable answer", () => {
    expect(finishExtraction("not an object", { allowedCategories: allowed, previous: EMPTY_DRAFT })).toEqual({
      draft: EMPTY_DRAFT,
      missing: ["amount", "expense_date", "category", "description"],
      reply: "How much did you spend, in rupees?",
    });
  });
});

describe("prompt and schema", () => {
  const rules: PolicyRule[] = [
    { category: "meals", grade: "L2", max_amount: 800, receipt_required_above: 300, notes: "Per day while travelling" },
  ];

  it("gives the model today's India date and the earlier draft, but no policy limits", () => {
    const { system, user } = buildExtractionPrompt({
      message: "lunch 500 yesterday",
      today: "2026-11-12",
      grade: "L2",
      rules,
      draft: { ...EMPTY_DRAFT, amount: 500 },
    });
    expect(user).toBe("lunch 500 yesterday");
    expect(system).toContain("Today's date is 2026-11-12");
    expect(system).toContain("- meals: Per day while travelling");
    expect(system).toContain('"amount":500');
    expect(system).not.toContain("800");
  });

  it("limits the category to the allowed codes or null", () => {
    const schema = extractionSchema(["meals"]) as { properties: { category: { enum: unknown[] } } };
    expect(schema.properties.category.enum).toEqual(["meals", null]);
  });
});
