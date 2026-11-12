import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Team passcode gate.
 *
 * The passcode lives only in the APP_PASSWORD server setting. After a correct
 * passcode, the server sets an httpOnly cookie holding an expiry time and an
 * HMAC signature keyed by APP_PASSWORD, so the cookie can't be forged and
 * stops working when the passcode changes. If APP_PASSWORD is empty, every
 * check fails: the app stays locked rather than open.
 *
 * Used by proxy.ts (every request) and by routes that spend money (Gemini).
 */

export const ACCESS_COOKIE = "claimease_access";
export const ACCESS_TTL_SECONDS = 7 * 24 * 60 * 60;

function sign(expiresAt: number, password: string): string {
  return createHmac("sha256", password).update(`claimease-access-v1:${expiresAt}`).digest("hex");
}

function sameText(a: string, b: string): boolean {
  // Hash first so the comparison takes the same time whatever the lengths.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** True when the passcode matches APP_PASSWORD (false if it isn't set). */
export function isCorrectPasscode(passcode: string, password: string | undefined): boolean {
  if (!password) return false;
  return sameText(passcode, password);
}

/** Cookie value for a successful unlock. */
export function createAccessToken(password: string, now: number = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + ACCESS_TTL_SECONDS;
  return `${expiresAt}.${sign(expiresAt, password)}`;
}

/** True for an unexpired cookie signed with the current APP_PASSWORD. */
export function isValidAccessToken(
  token: string | undefined,
  password: string | undefined,
  now: number = Date.now(),
): boolean {
  if (!token || !password) return false;
  const [expiresText, signature, ...rest] = token.split(".");
  if (rest.length > 0 || !/^\d+$/.test(expiresText ?? "") || !signature) return false;
  const expiresAt = Number(expiresText);
  if (expiresAt * 1000 <= now) return false;
  return sameText(signature, sign(expiresAt, password));
}

/** Reads the access cookie from a raw Cookie header. */
export function accessTokenFromCookieHeader(header: string | null): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === ACCESS_COOKIE) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

/** For route handlers: true when the request carries a valid access cookie. */
export function hasAppAccess(request: Request): boolean {
  return isValidAccessToken(
    accessTokenFromCookieHeader(request.headers.get("cookie")),
    process.env.APP_PASSWORD,
  );
}

/** Only same-site paths are allowed as the "continue to" target after unlocking. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/claims/new";
  return value;
}
