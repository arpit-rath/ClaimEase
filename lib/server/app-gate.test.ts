import { describe, expect, it } from "vitest";

import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  accessTokenFromCookieHeader,
  createAccessToken,
  isCorrectPasscode,
  isValidAccessToken,
  safeNextPath,
} from "@/lib/server/app-gate";

const now = Date.UTC(2026, 10, 12, 12, 0, 0);

describe("isCorrectPasscode", () => {
  it("accepts the exact passcode", () => {
    expect(isCorrectPasscode("orbit-2026", "orbit-2026")).toBe(true);
  });

  it.each(["orbit-2025", "Orbit-2026", "orbit-2026 ", ""])("rejects %j", (guess) => {
    expect(isCorrectPasscode(guess, "orbit-2026")).toBe(false);
  });

  it("rejects everything when APP_PASSWORD is not set", () => {
    expect(isCorrectPasscode("", undefined)).toBe(false);
    expect(isCorrectPasscode("anything", "")).toBe(false);
  });
});

describe("access token", () => {
  const token = createAccessToken("orbit-2026", now);

  it("is valid with the same passcode before it expires", () => {
    expect(isValidAccessToken(token, "orbit-2026", now)).toBe(true);
    expect(isValidAccessToken(token, "orbit-2026", now + (ACCESS_TTL_SECONDS - 60) * 1000)).toBe(true);
  });

  it("expires after the time limit", () => {
    expect(isValidAccessToken(token, "orbit-2026", now + ACCESS_TTL_SECONDS * 1000)).toBe(false);
  });

  it("stops working when the passcode changes", () => {
    expect(isValidAccessToken(token, "new-passcode", now)).toBe(false);
  });

  it("rejects a token whose expiry was edited", () => {
    const [, signature] = token.split(".");
    const later = Math.floor(now / 1000) + ACCESS_TTL_SECONDS * 10;
    expect(isValidAccessToken(`${later}.${signature}`, "orbit-2026", now)).toBe(false);
  });

  it.each([undefined, "", "abc", "123", "123.", ".abc", "12.ab.cd"])("rejects malformed token %j", (bad) => {
    expect(isValidAccessToken(bad, "orbit-2026", now)).toBe(false);
  });

  it("rejects every token when APP_PASSWORD is not set", () => {
    expect(isValidAccessToken(token, undefined, now)).toBe(false);
  });
});

describe("helpers", () => {
  it("reads the access cookie from a Cookie header", () => {
    expect(accessTokenFromCookieHeader(`a=1; ${ACCESS_COOKIE}=123.abc; b=2`)).toBe("123.abc");
    expect(accessTokenFromCookieHeader("a=1")).toBeUndefined();
    expect(accessTokenFromCookieHeader(null)).toBeUndefined();
  });

  it.each([
    ["/claims", "/claims"],
    ["/finance?x=1", "/finance?x=1"],
    [null, "/claims/new"],
    ["https://evil.example", "/claims/new"],
    ["//evil.example", "/claims/new"],
    ["/\\evil.example", "/claims/new"],
  ])("safeNextPath(%j) is %j", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
