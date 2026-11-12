import { describe, expect, it } from "vitest";

import { WITHIN_POLICY, type PolicyRule } from "@/types/api";
import {
  checkAmount,
  checkExpenseDate,
  daysBetween,
  evaluateClaimPolicy,
  isValidIsoDate,
  todayInIndia,
} from "@/lib/server/claim-rules";

const today = "2026-11-12";
const mealsRule: PolicyRule = {
  category: "meals",
  grade: "L2",
  max_amount: 800,
  receipt_required_above: 300,
  notes: "Per day while travelling",
};
// Seeded L2 rule used in the demo.
const clientRule: PolicyRule = {
  category: "client_entertainment",
  grade: "L2",
  max_amount: 3000,
  receipt_required_above: 0,
  notes: "Client meals. Write the client name in the description",
};

describe("checkExpenseDate", () => {
  it("rejects future dates", () => {
    expect(checkExpenseDate("2026-11-13", today)).toMatchObject({
      ok: false,
      code: "FUTURE_DATE",
    });
  });

  it("allows today's date", () => {
    expect(checkExpenseDate(today, today)).toBeNull();
  });

  it("allows an expense exactly 60 days old", () => {
    expect(daysBetween("2026-09-13", today)).toBe(60);
    expect(checkExpenseDate("2026-09-13", today)).toBeNull();
  });

  it("rejects an expense 61 days old", () => {
    expect(checkExpenseDate("2026-09-12", today)).toMatchObject({
      ok: false,
      code: "EXPENSE_TOO_OLD",
    });
  });
});

describe("checkAmount", () => {
  it("allows an amount equal to the policy maximum", () => {
    expect(checkAmount(800, "L2", mealsRule)).toEqual({
      status: "submitted",
      policy_check: WITHIN_POLICY,
    });
  });

  it("flags an amount above the policy maximum with a clear reason", () => {
    expect(checkAmount(800.01, "L2", mealsRule)).toEqual({
      status: "flagged",
      policy_check: "Above L2 limit of 800 for meals",
    });
  });
});

describe("isValidIsoDate", () => {
  it.each(["2026-11-12", "2028-02-29", "2026-01-31"])("accepts %s", (value) => {
    expect(isValidIsoDate(value)).toBe(true);
  });

  it.each(["2026-02-30", "2026-13-01", "2027-02-29", "12/11/2026", "2026-1-5", ""])(
    "rejects %s",
    (value) => {
      expect(isValidIsoDate(value)).toBe(false);
    },
  );
});

describe("evaluateClaimPolicy", () => {
  const context = { grade: "L2" as const, rule: clientRule, today };
  const claim = (amount: number, expense_date = today) => ({
    category: "client_entertainment",
    amount,
    expense_date,
  });

  describe("amount limit (L2 client_entertainment, max 3000)", () => {
    it("allows an amount below the limit as submitted", () => {
      expect(evaluateClaimPolicy(claim(2999.99), context)).toEqual({
        allowed: true,
        status: "submitted",
        limit: 3000,
        reason: WITHIN_POLICY,
      });
    });

    it("allows an amount exactly at the limit as submitted", () => {
      expect(evaluateClaimPolicy(claim(3000), context)).toEqual({
        allowed: true,
        status: "submitted",
        limit: 3000,
        reason: WITHIN_POLICY,
      });
    });

    it("allows an amount above the limit but flags it with the reason", () => {
      expect(evaluateClaimPolicy(claim(3000.01), context)).toEqual({
        allowed: true,
        status: "flagged",
        limit: 3000,
        reason: "Above L2 limit of 3000 for client_entertainment",
      });
    });
  });

  describe("expense age (today in India is 2026-11-12)", () => {
    it("allows an expense dated today", () => {
      expect(evaluateClaimPolicy(claim(100, today), context)).toMatchObject({ allowed: true });
    });

    it("allows an expense exactly 60 days old", () => {
      expect(evaluateClaimPolicy(claim(100, "2026-09-13"), context)).toMatchObject({
        allowed: true,
        status: "submitted",
      });
    });

    it("refuses an expense 61 days old", () => {
      expect(evaluateClaimPolicy(claim(100, "2026-09-12"), context)).toEqual({
        allowed: false,
        code: "EXPENSE_TOO_OLD",
        reason: "Expenses older than 60 days cannot be claimed.",
      });
    });

    it("refuses an old expense even when it is also over the limit (no flagged save)", () => {
      expect(evaluateClaimPolicy(claim(5000, "2026-08-01"), context)).toMatchObject({
        allowed: false,
        code: "EXPENSE_TOO_OLD",
      });
    });

    it("refuses a future date", () => {
      expect(evaluateClaimPolicy(claim(100, "2026-11-13"), context)).toMatchObject({
        allowed: false,
        code: "FUTURE_DATE",
      });
    });
  });

  describe("missing or mismatched policy rule", () => {
    it("refuses when no rule exists for the category and grade", () => {
      expect(evaluateClaimPolicy(claim(100), { ...context, rule: null })).toEqual({
        allowed: false,
        code: "UNKNOWN_CATEGORY",
        reason: "No L2 policy exists for category client_entertainment.",
      });
    });

    it("refuses a rule for a different grade instead of using it", () => {
      const l1Rule = { ...clientRule, grade: "L1" as const, max_amount: 1500 };
      expect(evaluateClaimPolicy(claim(100), { ...context, rule: l1Rule })).toMatchObject({
        allowed: false,
        code: "UNKNOWN_CATEGORY",
      });
    });

    it("refuses a rule for a different category instead of using it", () => {
      expect(evaluateClaimPolicy(claim(100), { ...context, rule: mealsRule })).toMatchObject({
        allowed: false,
        code: "UNKNOWN_CATEGORY",
      });
    });
  });

  describe("invalid input", () => {
    it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])("refuses amount %s", (amount) => {
      expect(evaluateClaimPolicy(claim(amount), context)).toMatchObject({
        allowed: false,
        code: "VALIDATION_ERROR",
      });
    });

    it.each(["2026-02-30", "12/11/2026", ""])("refuses expense date %j", (date) => {
      expect(evaluateClaimPolicy(claim(100, date), context)).toMatchObject({
        allowed: false,
        code: "VALIDATION_ERROR",
      });
    });

    it("throws when today's date is not provided correctly (a server bug, not user input)", () => {
      expect(() => evaluateClaimPolicy(claim(100), { ...context, today: "not-a-date" })).toThrow();
    });
  });
});

describe("todayInIndia", () => {
  it("uses the supplied instant and India calendar date", () => {
    expect(todayInIndia(new Date("2026-11-11T18:29:59.000Z"))).toBe("2026-11-11");
    expect(todayInIndia(new Date("2026-11-11T18:30:00.000Z"))).toBe("2026-11-12");
  });
});
