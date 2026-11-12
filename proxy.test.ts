import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "@/proxy";
import { ACCESS_COOKIE, createAccessToken } from "@/lib/server/app-gate";

function request(path: string, unlocked = false) {
  const headers = new Headers();
  if (unlocked) headers.set("cookie", `${ACCESS_COOKIE}=${createAccessToken("orbit-2026")}`);
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

describe("proxy (team passcode gate)", () => {
  beforeEach(() => vi.stubEnv("APP_PASSWORD", "orbit-2026"));
  afterEach(() => vi.unstubAllEnvs());

  it("shows the passcode page at / when locked", () => {
    const response = proxy(request("/"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("forwards an unlocked visitor from / to the app", () => {
    const response = proxy(request("/", true));
    expect(response.headers.get("location")).toBe("http://localhost:3000/claims/new");
  });

  it("forwards an unlocked visitor to the page they asked for, but not off-site", () => {
    expect(proxy(request("/?next=/finance", true)).headers.get("location")).toBe("http://localhost:3000/finance");
    expect(proxy(request("/?next=//evil.example", true)).headers.get("location")).toBe("http://localhost:3000/claims/new");
  });

  it("redirects a locked page to the passcode page, remembering where it was going", () => {
    const location = proxy(request("/claims?x=1")).headers.get("location");
    expect(location).toBe("http://localhost:3000/?next=%2Fclaims%3Fx%3D1");
  });

  it.each(["/api/extract", "/api/claims", "/api/finance/claims"])("answers 401 for locked API %s", async (path) => {
    const response = proxy(request(path));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("always lets the unlock endpoint through", () => {
    const response = proxy(request("/api/unlock"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("lets unlocked requests through", () => {
    expect(proxy(request("/claims", true)).headers.get("location")).toBeNull();
    expect(proxy(request("/api/claims", true)).status).toBe(200);
  });

  it("keeps everything locked when APP_PASSWORD is not set", () => {
    vi.stubEnv("APP_PASSWORD", "");
    expect(proxy(request("/claims", true)).headers.get("location")).toContain("/?next=");
    expect(proxy(request("/api/claims", true)).status).toBe(401);
  });
});
