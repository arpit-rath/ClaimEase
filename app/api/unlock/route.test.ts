import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { POST } from "@/app/api/unlock/route";
import { ACCESS_COOKIE, isValidAccessToken } from "@/lib/server/app-gate";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/unlock", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/unlock", () => {
  beforeEach(() => {
    vi.stubEnv("APP_PASSWORD", "orbit-2026");
    vi.useFakeTimers({ toFake: ["setTimeout"] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("sets a valid, httpOnly access cookie for the right passcode", async () => {
    const response = await post({ passcode: "orbit-2026" });

    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${ACCESS_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    const token = cookie.split(";")[0].split("=")[1];
    expect(isValidAccessToken(token, "orbit-2026")).toBe(true);
  });

  it("refuses a wrong passcode without setting a cookie", async () => {
    const pending = post({ passcode: "guess" });
    await vi.runAllTimersAsync();
    const response = await pending;

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  it("stays locked when APP_PASSWORD is not set, even for an empty-looking guess", async () => {
    vi.stubEnv("APP_PASSWORD", "");
    const response = await post({ passcode: "x" });

    expect(response.status).toBe(500);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([{}, { passcode: "" }, { passcode: "x", extra: 1 }])("rejects a bad body %j", async (body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
