import { connection } from "next/server";
import { z } from "zod";

import { ExtractRequestSchema, type ExtractResponse } from "@/types/api";
import { AiUnavailableError, generateJson } from "@/lib/ai/gemini";
import { buildExtractionPrompt, EMPTY_DRAFT, extractionSchema, finishExtraction } from "@/lib/ai/extract";
import { todayInIndia } from "@/lib/server/claim-rules";
import { listPolicyRules } from "@/lib/server/claims-repo";
import { getCurrentEmployee } from "@/lib/server/current-employee";
import { apiError, serverError } from "@/lib/server/http";

/**
 * Turns a plain-language message into a claim draft for the employee to review.
 * Nothing is saved here; POST /api/claims makes the policy decision on submit.
 */
export async function POST(request: Request) {
  await connection();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Request body must be valid JSON.");
  }

  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) {
    const { formErrors, fieldErrors } = z.flattenError(parsed.error);
    const fields: Record<string, string[]> = { ...fieldErrors };
    if (formErrors.length > 0) fields._root = formErrors;
    return apiError(400, "VALIDATION_ERROR", "Type a message describing your expense.", fields);
  }
  const previous = parsed.data.draft ?? EMPTY_DRAFT;

  try {
    const employee = await getCurrentEmployee();
    if (!employee) return apiError(404, "NOT_FOUND", "Employee not found.");

    const rules = await listPolicyRules(employee.grade);
    const allowedCategories = rules.map((r) => r.category);
    const prompt = buildExtractionPrompt({
      message: parsed.data.message,
      today: todayInIndia(),
      grade: employee.grade,
      rules,
      draft: previous,
    });

    const raw = await generateJson({ ...prompt, schema: extractionSchema(allowedCategories) });
    const result = finishExtraction(raw, { allowedCategories, previous });
    return Response.json(result satisfies ExtractResponse);
  } catch (cause) {
    if (cause instanceof AiUnavailableError) {
      return apiError(
        503,
        "AI_UNAVAILABLE",
        "The assistant couldn't read that right now. Try again, or fill in the details yourself.",
      );
    }
    return serverError("POST /api/extract", cause);
  }
}
