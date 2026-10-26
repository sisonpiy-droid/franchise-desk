// Provider-agnostic model adapter. Server-side only: keys never reach the browser.
// complete(prompt, jsonSchema) returns parsed JSON or throws. Gemini is tried first; if it fails (quota, outage, timeout,
// bad answer) OpenRouter is tried as a backup. If neither answers, callers fall back to the rule-based desk.
import "server-only";

const TIMEOUT_MS = 6000;
let discovered: string | null = null;

export class LlmError extends Error {}

const geminiKey = () => process.env.GEMINI_API_KEY?.trim() || "";
const routerKey = () => process.env.OPENROUTER_API_KEY?.trim() || "";

export function llmConfigured(): boolean {
  return Boolean(geminiKey() || routerKey());
}

async function pickModel(key: string): Promise<string> {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  if (discovered) return discovered;
  // Not hardcoded: list the models available to this key and take a current Flash model.
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(3000) });
    const j = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const names = (j.models ?? []).filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => m.name.replace(/^models\//, ""));
    discovered = names.find((n) => n === "gemini-flash-latest") ?? names.find((n) => /flash$/.test(n) && !/lite|image|tts|preview/.test(n)) ?? "gemini-flash-latest";
  } catch {
    discovered = "gemini-flash-latest";
  }
  return discovered;
}

async function viaGemini(prompt: string, jsonSchema: object, system: string | undefined, timeoutMs: number): Promise<unknown> {
  const key = geminiKey();
  if (!key) throw new LlmError("no gemini key");
  const model = await pickModel(key);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: jsonSchema, temperature: 0 },
    }),
  });
  if (!res.ok) throw new LlmError(`model http ${res.status}`);
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    return JSON.parse(text);
  } catch {
    throw new LlmError("model returned non-JSON");
  }
}

/** OpenRouter takes the same prompt; the schema goes into the instructions because it cannot enforce Gemini's schema format. */
async function viaOpenRouter(prompt: string, jsonSchema: object, system: string | undefined, timeoutMs: number): Promise<unknown> {
  const key = routerKey();
  if (!key) throw new LlmError("no openrouter key");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "x-title": "Franchise Desk" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.5-flash",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${system ?? ""}\nReply with one JSON object only, no prose, matching this schema (types are written in capitals): ${JSON.stringify(jsonSchema)}`.trim() },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new LlmError(`backup http ${res.status}`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = (j.choices?.[0]?.message?.content ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    throw new LlmError("backup returned non-JSON");
  }
}

export async function complete(prompt: string, jsonSchema: object, system?: string, timeoutMs: number = TIMEOUT_MS): Promise<unknown> {
  if (!llmConfigured()) throw new LlmError("no key");
  const started = Date.now();
  if (geminiKey()) {
    try {
      return await viaGemini(prompt, jsonSchema, system, timeoutMs);
    } catch (e) {
      if (!routerKey()) throw e;
    }
  }
  // the backup gets whatever is left of the caller's time budget, but never less than a few seconds
  const left = Math.max(4000, timeoutMs - (Date.now() - started));
  return viaOpenRouter(prompt, jsonSchema, system, left);
}
