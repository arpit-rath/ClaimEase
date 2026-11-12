import "server-only";

/**
 * Minimal Gemini client for structured (JSON) answers. Server only: the API
 * key never reaches the browser.
 *
 * Tries each model in GEMINI_MODEL (comma-separated) in order, moving on when
 * a model is overloaded, retired or too slow, within an overall time budget.
 */

// Lite first: in testing it answered extraction prompts accurately and fastest.
const DEFAULT_MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash"];
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export type GenerateJsonRequest = {
  system: string;
  user: string;
  /** JSON Schema the answer must follow. */
  schema: Record<string, unknown>;
};

export type GenerateJsonOptions = {
  apiKey?: string;
  models?: string[];
  /** Longest wait for one model. */
  perAttemptMs?: number;
  /** Longest wait across all models. */
  totalMs?: number;
  fetchImpl?: typeof fetch;
};

export function configuredModels(): string[] {
  const fromEnv = (process.env.GEMINI_MODEL ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_MODELS;
}

/** Returns the model's JSON answer (parsed, not yet validated). */
export async function generateJson(
  request: GenerateJsonRequest,
  options: GenerateJsonOptions = {},
): Promise<unknown> {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AiUnavailableError("GEMINI_API_KEY is not set.");

  const models = options.models ?? configuredModels();
  const perAttemptMs = options.perAttemptMs ?? 15_000;
  const totalMs = options.totalMs ?? 32_000;
  const doFetch = options.fetchImpl ?? fetch;
  const started = Date.now();
  const problems: string[] = [];

  for (const model of models) {
    const remaining = totalMs - (Date.now() - started);
    if (remaining < 1_000) break;

    try {
      const response = await doFetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(Math.min(perAttemptMs, remaining)),
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: "user", parts: [{ text: request.user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: request.schema,
            temperature: 0,
          },
        }),
      });

      if (!response.ok) {
        problems.push(`${model}: HTTP ${response.status}`);
        continue;
      }

      const body = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      try {
        return JSON.parse(text);
      } catch {
        problems.push(`${model}: answer was not JSON`);
      }
    } catch (cause) {
      const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
      problems.push(`${model}: ${timedOut ? "timed out" : "request failed"}`);
    }
  }

  console.warn(`[ai] Gemini unavailable: ${problems.join("; ") || "no time left"}`);
  throw new AiUnavailableError("The assistant is unavailable right now.");
}
