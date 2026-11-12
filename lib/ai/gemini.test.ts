import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AiUnavailableError, generateJson } from "@/lib/ai/gemini";

const request = { system: "s", user: "u", schema: { type: "object" } };
const ok = (json: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }), {
    status: 200,
  });

describe("generateJson", () => {
  it("refuses to call Gemini without an API key", async () => {
    const fetchImpl = vi.fn();
    await expect(generateJson(request, { apiKey: "", fetchImpl })).rejects.toBeInstanceOf(AiUnavailableError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the key in a header, not the URL, and returns the parsed JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ amount: 1 }));
    await expect(generateJson(request, { apiKey: "k", models: ["m1"], fetchImpl })).resolves.toEqual({ amount: 1 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).not.toContain("k=");
    expect(init.headers["x-goog-api-key"]).toBe("k");
  });

  it("falls back to the next model when one is overloaded", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(ok({ amount: 2 }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(generateJson(request, { apiKey: "k", models: ["busy", "backup"], fetchImpl })).resolves.toEqual({ amount: 2 });
    expect(fetchImpl.mock.calls[1][0]).toContain("/backup:generateContent");
  });

  it("gives up with AiUnavailableError when every model fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockRejectedValueOnce(new TypeError("network"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(generateJson(request, { apiKey: "k", models: ["a", "b"], fetchImpl })).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("treats a non-JSON answer as a failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "hello" }] } }] }), { status: 200 }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(generateJson(request, { apiKey: "k", models: ["a"], fetchImpl })).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
