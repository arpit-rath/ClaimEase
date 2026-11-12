import { z } from "zod";

import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  createAccessToken,
  isCorrectPasscode,
} from "@/lib/server/app-gate";
import { apiError } from "@/lib/server/http";

const UnlockRequestSchema = z.strictObject({ passcode: z.string().min(1).max(200) });

/** Small delay on wrong guesses to slow down guessing. */
const WRONG_PASSCODE_DELAY_MS = 600;

/** Checks the team passcode and, if correct, sets the access cookie. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Enter the team passcode.");
  }
  const parsed = UnlockRequestSchema.safeParse(body);
  if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Enter the team passcode.");

  const password = process.env.APP_PASSWORD;
  if (!password) {
    console.warn("[gate] APP_PASSWORD is not set; the app stays locked.");
    return apiError(500, "SERVER_ERROR", "The app passcode hasn't been set up on the server yet.");
  }

  if (!isCorrectPasscode(parsed.data.passcode, password)) {
    await new Promise((resolve) => setTimeout(resolve, WRONG_PASSCODE_DELAY_MS));
    return apiError(401, "UNAUTHORIZED", "That passcode isn't right. Try again.");
  }

  const response = Response.json({ ok: true });
  const cookie = [
    `${ACCESS_COOKIE}=${createAccessToken(password)}`,
    "Path=/",
    `Max-Age=${ACCESS_TTL_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ].join("; ");
  response.headers.append("Set-Cookie", cookie);
  return response;
}
