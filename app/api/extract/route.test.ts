import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentEmployee: vi.fn(),
  listPolicyRules: vi.fn(),
  generateJson: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/server/current-employee", () => ({ getCurrentEmployee: mocks.getCurrentEmployee }));
vi.mock("@/lib/server/claims-repo", () => ({ listPolicyRules: mocks.listPolicyRules }));
vi.mock("@/lib/ai/gemini", async () => {
  class AiUnavailableError extends Error {}
  return { AiUnavailableError, generateJson: mocks.generateJson };
});

import { POST } from "@/app/api/extract/route";
import { AiUnavailableError } from "@/lib/ai/gemini";
import { ACCESS_COOKIE, createAccessToken } from "@/lib/server/app-gate";

const post = (body: unknown, unlocked = true) =>
  POST(
    new Request("http://localhost/api/extract", {
      method: "POST",
      body: JSON.stringify(body),
      headers: unlocked ? { cookie: `${ACCESS_COOKIE}=${createAccessToken("orbit-2026")}` } : {},
    }),
  );

describe("POST /api/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_PASSWORD", "orbit-2026");
    mocks.getCurrentEmployee.mockResolvedValue({ id: "E001", grade: "L2" });
    mocks.listPolicyRules.mockResolvedValue([
      { category: "client_entertainment", grade: "L2", max_amount: 3000, receipt_required_above: 0, notes: "Client meals" },
    ]);
  });

  it("refuses without the team passcode cookie and never calls Gemini", async () => {
    const response = await post({ message: "lunch 500" }, false);
    expect(response.status).toBe(401);
    expect(mocks.getCurrentEmployee).not.toHaveBeenCalled();
    expect(mocks.generateJson).not.toHaveBeenCalled();
  });

  it("rejects an empty message without calling the AI", async () => {
    const response = await post({ message: "   " });
    expect(response.status).toBe(400);
    expect(mocks.generateJson).not.toHaveBeenCalled();
  });

  it("uses the employee's grade from the database to choose categories", async () => {
    mocks.generateJson.mockResolvedValue({
      amount: 2400, expense_date: "2026-11-11", category: "client_entertainment", description: "Client dinner", has_receipt: null, reply: "Ready to review.",
    });

    const response = await post({ message: "I spent ₹2,400 on a client dinner yesterday, submit it." });

    expect(response.status).toBe(200);
    expect(mocks.listPolicyRules).toHaveBeenCalledWith("L2");
    expect(await response.json()).toEqual({
      draft: { amount: 2400, expense_date: "2026-11-11", category: "client_entertainment", description: "Client dinner", has_receipt: null },
      missing: [],
      reply: "Ready to review.",
    });
  });

  it("never saves a claim, even when the message says submit", async () => {
    // The route has no access to insertClaim at all: claims-repo is mocked with only listPolicyRules.
    mocks.generateJson.mockResolvedValue({ amount: 100, reply: "?" });
    const response = await post({ message: "100 rupees, submit it now" });
    expect(response.status).toBe(200);
  });

  it("returns 503 AI_UNAVAILABLE when the assistant can't answer", async () => {
    mocks.generateJson.mockRejectedValue(new AiUnavailableError("down"));
    const response = await post({ message: "lunch 500" });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "AI_UNAVAILABLE" } });
  });
});
