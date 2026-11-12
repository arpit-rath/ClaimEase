import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/claims/route";
import type { PolicyRule } from "@/types/api";

const mocks = vi.hoisted(() => ({
  getCurrentEmployee: vi.fn(),
  getPolicyRule: vi.fn(),
  insertClaim: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/server/current-employee", () => ({
  getCurrentEmployee: mocks.getCurrentEmployee,
  getCurrentEmployeeId: vi.fn(),
}));
vi.mock("@/lib/server/claims-repo", () => ({
  getPolicyRule: mocks.getPolicyRule,
  insertClaim: mocks.insertClaim,
  listClaims: vi.fn(),
}));

const employee = {
  id: "E001",
  name: "Meera Nair",
  email: "meera.nair@example.test",
  grade: "L2" as const,
  department: "Consulting",
  manager_name: "Ravi Shankar",
  base_city: "Chennai",
};

const mealsRule: PolicyRule = {
  category: "meals",
  grade: "L2",
  max_amount: 800,
  receipt_required_above: 300,
  notes: "Per day while travelling",
};

function request(body: string): Request {
  return new Request("http://localhost/api/claims", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("POST /api/claims validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentEmployee.mockResolvedValue(employee);
    mocks.getPolicyRule.mockResolvedValue(mealsRule);
    mocks.insertClaim.mockResolvedValue({ id: 1 });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects malformed JSON without loading employee or writing a claim", async () => {
    const response = await POST(request("{"));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(mocks.getCurrentEmployee).not.toHaveBeenCalled();
    expect(mocks.insertClaim).not.toHaveBeenCalled();
  });

  it.each([
    ["zero amount", { category: "meals", amount: 0 }],
    ["unsupported category", { category: "unknown", amount: 100 }],
    ["invalid calendar date", { category: "meals", amount: 100, expense_date: "2026-02-30" }],
  ])("rejects invalid input (%s)", async (_case, override) => {
    const body = Object.assign(
      {
        category: "meals",
        amount: 100,
        expense_date: "2026-11-12",
        description: "Lunch while travelling",
        has_receipt: true,
      },
      override,
    );

    const response = await POST(request(JSON.stringify(body)));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(mocks.getCurrentEmployee).not.toHaveBeenCalled();
    expect(mocks.insertClaim).not.toHaveBeenCalled();
  });

  it.each([
    ["future date", "2026-11-13", "FUTURE_DATE"],
    ["date 61 days old", "2026-09-12", "EXPENSE_TOO_OLD"],
  ])("rejects %s without writing a claim", async (_case, expenseDate, code) => {
    const response = await POST(
      request(
        JSON.stringify({
          category: "meals",
          amount: 100,
          expense_date: expenseDate,
          description: "Lunch while travelling",
        }),
      ),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code } });
    expect(mocks.getCurrentEmployee).not.toHaveBeenCalled();
    expect(mocks.insertClaim).not.toHaveBeenCalled();
  });

  it("allows a date exactly 60 days old", async () => {
    const response = await POST(
      request(
        JSON.stringify({
          category: "meals",
          amount: 800,
          expense_date: "2026-09-13",
          description: "Lunch while travelling",
          has_receipt: true,
        }),
      ),
    );

    expect(response.status).toBe(201);
    expect(mocks.insertClaim).toHaveBeenCalledWith(
      expect.objectContaining({ expense_date: "2026-09-13", status: "submitted" }),
    );
  });

  it.each([
    ["below the limit", 799.99, "submitted", "Within policy"],
    ["exactly at the limit", 800, "submitted", "Within policy"],
    ["above the limit", 800.01, "flagged", "Above L2 limit of 800 for meals"],
  ])("saves an amount %s with the server's decision", async (_case, amount, status, reason) => {
    const response = await POST(
      request(
        JSON.stringify({
          category: "meals",
          amount,
          expense_date: "2026-11-12",
          description: "Lunch while travelling",
          has_receipt: true,
        }),
      ),
    );

    expect(response.status).toBe(201);
    expect(mocks.insertClaim).toHaveBeenCalledTimes(1);
    expect(mocks.insertClaim).toHaveBeenCalledWith(
      expect.objectContaining({ amount, status, policy_check: reason }),
    );
  });

  it("does not flag a claim only because there is no receipt", async () => {
    const response = await POST(
      request(
        JSON.stringify({
          category: "meals",
          amount: 500,
          expense_date: "2026-11-12",
          description: "Lunch while travelling",
          has_receipt: false,
        }),
      ),
    );

    expect(response.status).toBe(201);
    expect(mocks.insertClaim).toHaveBeenCalledWith(
      expect.objectContaining({ has_receipt: false, status: "submitted", policy_check: "Within policy" }),
    );
  });

  it("looks up the rule with the employee's grade from the database, not the request", async () => {
    mocks.getCurrentEmployee.mockResolvedValue({ ...employee, grade: "L1" });
    mocks.getPolicyRule.mockResolvedValue({ ...mealsRule, grade: "L1", max_amount: 500 });

    const response = await POST(
      request(
        JSON.stringify({
          category: "meals",
          amount: 600,
          expense_date: "2026-11-12",
          description: "Lunch while travelling",
          has_receipt: true,
        }),
      ),
    );

    expect(response.status).toBe(201);
    expect(mocks.getPolicyRule).toHaveBeenCalledWith("meals", "L1");
    expect(mocks.insertClaim).toHaveBeenCalledWith(
      expect.objectContaining({ status: "flagged", policy_check: "Above L1 limit of 500 for meals" }),
    );
  });

  it("rejects a request that tries to set its own status or employee", async () => {
    const response = await POST(
      request(
        JSON.stringify({
          category: "meals",
          amount: 100,
          expense_date: "2026-11-12",
          description: "Lunch while travelling",
          status: "approved",
          employee_id: "E004",
        }),
      ),
    );

    expect(response.status).toBe(400);
    expect(mocks.insertClaim).not.toHaveBeenCalled();
  });

  it("rejects a missing category/grade policy rule", async () => {
    mocks.getPolicyRule.mockResolvedValue(null);

    const response = await POST(
      request(
        JSON.stringify({
          category: "meals",
          amount: 100,
          expense_date: "2026-11-12",
          description: "Lunch while travelling",
        }),
      ),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: "UNKNOWN_CATEGORY" } });
    expect(mocks.insertClaim).not.toHaveBeenCalled();
  });
});
