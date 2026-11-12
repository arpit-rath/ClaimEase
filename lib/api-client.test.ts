import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock("@/lib/supabase/browser", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}));

import { approveClaim, authenticatedFetch, getFinanceClaims, rejectClaim } from "@/lib/api-client";

describe("authenticatedFetch", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetSession.mockReset();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the Supabase access token as a Bearer token", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "test-access-token" } },
      error: null,
    });

    await authenticatedFetch("/api/finance/claims", {
      headers: { "X-Test": "present" },
    });

    const requestHeaders = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(requestHeaders.get("authorization")).toBe("Bearer test-access-token");
    expect(requestHeaders.get("x-test")).toBe("present");
  });

  it("does not make the API request when there is no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(authenticatedFetch("/api/finance/claims")).rejects.toThrow(
      "Sign in before making authenticated API requests.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces Supabase session lookup errors", async () => {
    const authError = new Error("Session lookup failed");
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: authError,
    });

    await expect(authenticatedFetch("/api/finance/claims")).rejects.toBe(authError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("finance review client", () => {
  const session = { data: { session: { access_token: "test-access-token" } }, error: null };
  const savedClaim = {
    id: 25,
    employee_id: "E001",
    category: "client_entertainment",
    amount: 3001,
    expense_date: "2026-11-12",
    description: "TEST - Boundary: above limit",
    has_receipt: true,
    status: "approved",
    policy_check: "Above L2 limit of 3000 for client_entertainment",
    created_at: "2026-11-12T10:00:00+00:00",
  };
  let fetchMock: ReturnType<typeof vi.fn>;

  function respond(status: number, body: unknown) {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
  }

  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue(session);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports signed_out without calling the API when there is no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

    expect(await getFinanceClaims()).toEqual({ ok: false, failure: { kind: "signed_out" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the server's 403 FORBIDDEN through unchanged", async () => {
    respond(403, { error: { code: "FORBIDDEN", message: "Active finance membership is required." } });

    expect(await getFinanceClaims()).toEqual({
      ok: false,
      failure: { kind: "api", status: 403, code: "FORBIDDEN", message: "Active finance membership is required.", fields: undefined },
    });
  });

  it("treats a list in the wrong shape as unexpected instead of showing it", async () => {
    respond(200, { claims: [{ id: 1 }] });

    expect(await getFinanceClaims()).toEqual({ ok: false, failure: { kind: "unexpected", status: 200 } });
  });

  it("approves with the bearer token and returns the server's claim", async () => {
    respond(200, { claim: savedClaim });

    const result = await approveClaim(25);

    expect(result).toEqual({ ok: true, data: { claim: savedClaim } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/finance/claims/25/approve");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-access-token");
  });

  it("sends the rejection reason in the body", async () => {
    respond(200, { claim: { ...savedClaim, status: "rejected" } });

    await rejectClaim(25, "Business purpose missing");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/finance/claims/25/reject");
    expect(JSON.parse(init.body)).toEqual({ reason: "Business purpose missing" });
  });

  it("passes 409 CLAIM_NOT_REVIEWABLE through so the page can refresh", async () => {
    respond(409, { error: { code: "CLAIM_NOT_REVIEWABLE", message: "Claim is not awaiting finance review." } });

    const result = await approveClaim(25);

    expect(result).toMatchObject({ ok: false, failure: { kind: "api", status: 409, code: "CLAIM_NOT_REVIEWABLE" } });
  });
});
