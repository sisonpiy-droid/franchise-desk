// Pincode heat route: asks the model for a relative demand index per pin code. Rate-limited, budget-capped and cached.
// Only the pin code, city and tier are sent, never names or notes. If anything fails the browser falls back to tier averages.
import { complete, llmConfigured } from "@/lib/llm";
import { categoryOf } from "@/lib/engine/categories";
import { buildHeatPrompt, HEAT_SCHEMA, heatSystemFor, normaliseHeat, type HeatAsk, type HeatIndex } from "@/lib/heat/model";

export const dynamic = "force-dynamic";

const MAX_PINS = 80;
const MAX_INFLIGHT = 3;
const PER_IP_PER_MIN = 20;
const DAILY_BUDGET = Number(process.env.LLM_HEAT_DAILY_BUDGET ?? 200);
let inflight = 0;
let day = "";
let used = 0;
const hits = new Map<string, number[]>();
const cache = new Map<string, HeatIndex>(); // pin|city|tier -> index

function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > PER_IP_PER_MIN;
}

export async function POST(req: Request) {
  if (!llmConfigured()) return Response.json({ pins: {}, reason: "not configured" }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return Response.json({ pins: {}, reason: "rate limited" }, { status: 429 });
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    used = 0;
  }
  if (used >= DAILY_BUDGET) return Response.json({ pins: {}, reason: "daily budget reached" }, { status: 429 });

  let body: { items?: unknown; category?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ pins: {}, reason: "bad request" }, { status: 400 });
  }
  const cat = categoryOf(body.category);
  const seen = new Set<string>();
  const items: HeatAsk[] = [];
  for (const x of Array.isArray(body.items) ? body.items : []) {
    const r = x as { pin?: unknown; city?: unknown; tier?: unknown };
    const pin = typeof r.pin === "string" ? r.pin.trim() : "";
    if (!/^\d{6}$/.test(pin) || seen.has(pin)) continue;
    seen.add(pin);
    items.push({ pin, city: typeof r.city === "string" ? r.city.replace(/[^\p{L}\p{N} .-]/gu, "").slice(0, 40) : "", tier: [1, 2, 3].includes(Number(r.tier)) ? Number(r.tier) : 2 });
    if (items.length >= MAX_PINS) break;
  }
  if (!items.length) return Response.json({ pins: {}, reason: "no pin codes" }, { status: 400 });

  const out: Record<string, HeatIndex> = {};
  const todo: HeatAsk[] = [];
  for (const i of items) {
    const hit = cache.get(`${cat.id}|${i.pin}|${i.city}|${i.tier}`);
    if (hit) out[i.pin] = hit;
    else todo.push(i);
  }
  if (todo.length) {
    if (inflight >= MAX_INFLIGHT) return Response.json({ pins: out, reason: "busy" }, { status: 429 });
    inflight++;
    used++;
    try {
      const raw = await complete(buildHeatPrompt(todo, cat.id), HEAT_SCHEMA, heatSystemFor(cat.id), 25_000);
      const got = normaliseHeat(raw, todo.map((t) => t.pin));
      if (cache.size > 4000) cache.clear();
      for (const t of todo) {
        const g = got[t.pin];
        if (g) {
          out[t.pin] = g;
          cache.set(`${cat.id}|${t.pin}|${t.city}|${t.tier}`, g);
        }
      }
    } catch {
      // the browser shows tier averages for any pin missing from the answer
    } finally {
      inflight--;
    }
  }
  return Response.json({ pins: out, cached: todo.length === 0 });
}
