"use client";

/**
 * The frontend's calls to the backend.
 * Request/response formats: docs/api-contract.md and types/api.ts.
 *
 * The claim functions resolve to an ApiResult instead of throwing, so pages
 * can show the exact outcome: the data, an error the backend sent, or a
 * failure to reach the backend at all.
 */
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { z } from "zod";
import {
  API_ERROR_CODES,
  ClaimSchema,
  FinanceReviewClaimSchema,
  type ApiErrorCode,
  type CategoriesResponse,
  type ClaimsListResponse,
  type CreateClaimRequest,
  type CreateClaimResponse,
  type FinanceClaimReviewResponse,
  type FinanceClaimsListResponse,
  type MeResponse,
} from "@/types/api";

// ---------------------------------------------------------------------------
// Authenticated requests (Finance Review): sends the Supabase session token.
// ---------------------------------------------------------------------------

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error("Sign in before making authenticated API requests.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${data.session.access_token}`);

  return fetch(input, { ...init, headers });
}

// ---------------------------------------------------------------------------
// Employee claim requests (act as the demo employee on the server).
// ---------------------------------------------------------------------------

export type ApiFailure =
  /** The request never got a response (offline, server down, timeout). */
  | { kind: "network" }
  /** The backend answered with the documented error shape. */
  | { kind: "api"; status: number; code: ApiErrorCode; message: string; fields?: Record<string, string[]> }
  /** The backend answered, but not in the documented shape. */
  | { kind: "unexpected"; status: number }
  /** An authenticated call was attempted with no Supabase session in the browser. */
  | { kind: "signed_out" }
  /** Supabase sign-in is not available in the browser (e.g. missing public settings). */
  | { kind: "auth_unavailable"; message: string };

export type ApiResult<T> = { ok: true; data: T } | { ok: false; failure: ApiFailure };

function isApiErrorBody(
  body: unknown,
): body is { error: { code: ApiErrorCode; message: string; fields?: Record<string, string[]> } } {
  if (typeof body !== "object" || body === null || !("error" in body)) return false;
  const error = (body as { error: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { message?: unknown }).message === "string" &&
    (API_ERROR_CODES as readonly unknown[]).includes((error as { code?: unknown }).code)
  );
}

async function request<T>(
  path: string,
  init?: RequestInit,
  fetcher: (input: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetcher(path, {
      ...init,
      cache: "no-store",
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    });
  } catch {
    return { ok: false, failure: { kind: "network" } };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON: handled below as an unexpected response.
  }

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      const { code, message, fields } = body.error;
      return { ok: false, failure: { kind: "api", status: response.status, code, message, fields } };
    }
    return { ok: false, failure: { kind: "unexpected", status: response.status } };
  }

  if (body === null) return { ok: false, failure: { kind: "unexpected", status: response.status } };
  return { ok: true, data: body as T };
}

export function getMe() {
  return request<MeResponse>("/api/me");
}

export function getCategories() {
  return request<CategoriesResponse>("/api/categories");
}

export function getClaims() {
  return request<ClaimsListResponse>("/api/claims");
}

/**
 * Creates a claim. Succeeds only when the backend returns 201 with a claim in
 * the documented shape, so the UI never reports a claim as saved otherwise.
 */
export async function createClaim(body: CreateClaimRequest): Promise<ApiResult<CreateClaimResponse>> {
  const result = await request<CreateClaimResponse>("/api/claims", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!result.ok) return result;

  const claim = ClaimSchema.safeParse((result.data as { claim?: unknown })?.claim);
  if (!claim.success) return { ok: false, failure: { kind: "unexpected", status: 201 } };
  return { ok: true, data: { claim: claim.data } };
}

/** Fired after a claim is saved or reviewed so panels showing claims can refresh. */
export const CLAIMS_CHANGED_EVENT = "claimease:claims-changed";

// ---------------------------------------------------------------------------
// Finance Review (needs a signed-in user with finance access; the server checks).
// ---------------------------------------------------------------------------

/** Runs `request` with the Supabase access token, or reports why it can't. */
async function authorizedRequest<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const { data, error } = await getSupabaseBrowserClient().auth.getSession();
    if (error || !data.session) return { ok: false, failure: { kind: "signed_out" } };
  } catch (cause) {
    return {
      ok: false,
      failure: {
        kind: "auth_unavailable",
        message: cause instanceof Error ? cause.message : "Sign-in is not available.",
      },
    };
  }
  return request<T>(path, init, authenticatedFetch);
}

const FinanceClaimsListSchema = z.object({ claims: z.array(FinanceReviewClaimSchema) });

/** Claims awaiting review (status submitted or flagged), newest first. */
export async function getFinanceClaims(): Promise<ApiResult<FinanceClaimsListResponse>> {
  const result = await authorizedRequest<unknown>("/api/finance/claims");
  if (!result.ok) return result;
  const parsed = FinanceClaimsListSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, failure: { kind: "unexpected", status: 200 } };
  return { ok: true, data: parsed.data };
}

async function reviewClaim(
  claimId: number,
  action: "approve" | "reject",
  body?: { reason: string },
): Promise<ApiResult<FinanceClaimReviewResponse>> {
  const result = await authorizedRequest<{ claim?: unknown }>(
    `/api/finance/claims/${encodeURIComponent(String(claimId))}/${action}`,
    { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) },
  );
  if (!result.ok) return result;
  const claim = ClaimSchema.safeParse(result.data?.claim);
  if (!claim.success) return { ok: false, failure: { kind: "unexpected", status: 200 } };
  return { ok: true, data: { claim: claim.data } };
}

/** Approves a claim. Succeeds only when the server confirms the new status. */
export function approveClaim(claimId: number) {
  return reviewClaim(claimId, "approve");
}

/** Rejects a claim with a required reason. Succeeds only when the server confirms. */
export function rejectClaim(claimId: number, reason: string) {
  return reviewClaim(claimId, "reject", { reason });
}
