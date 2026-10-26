// Who came first, and what happened to them: arrival order against the rank the rules give, for one territory.
// The workbook has no submission dates, so the application number is used as arrival order (APP-001 came before APP-002).
// Ranking is: ready site, then score, then investment, then the earlier application. Arrival only breaks an exact tie.
import type { Decision, RunResult, Status } from "./types";

export interface Lane {
  key: string;
  id: string;
  name: string;
  status: Status;
  score: number | null;
  ready: boolean;
  invest: number | null;
  arrival: number; // 1-based position by application number
  rank: number; // 1-based position by the rules
}

export interface Race {
  lanes: Lane[];
  me: Lane;
  /** One plain sentence about this applicant's arrival against their rank. */
  headline: string;
  /** The reason, naming who outranks or is outranked, and whether arrival decided anything. */
  detail: string;
}

const idNum = (id: string) => {
  const m = id.match(/(\d+)(?!.*\d)/);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;

/** Same order as the engine's ranking, applied to everyone who applied in the territory. */
function compare(a: Decision, b: Decision): number {
  if (a.ready !== b.ready) return a.ready ? -1 : 1;
  const sa = a.score?.total ?? -1, sb = b.score?.total ?? -1;
  if (sa !== sb) return sb - sa;
  const ia = a.capex?.invest ?? -1, ib = b.capex?.invest ?? -1;
  if (ia !== ib) return ib - ia;
  return idNum(a.id) - idNum(b.id);
}

export function arrivalRace(result: RunResult, d: Decision): Race | null {
  if (!d.territoryKey) return null;
  const group = result.decisions.filter((x) => x.territoryKey === d.territoryKey && x.status !== "WITHDRAWN");
  if (group.length < 2) return null;
  const byArrival = [...group].sort((a, b) => idNum(a.id) - idNum(b.id));
  const byRank = [...group].sort(compare);
  const lane = (x: Decision): Lane => ({ key: x.key, id: x.id, name: x.name, status: x.status, score: x.score?.total ?? null, ready: x.ready, invest: x.capex?.invest ?? null, arrival: byArrival.indexOf(x) + 1, rank: byRank.indexOf(x) + 1 });
  const lanes = byArrival.map(lane);
  const me = lanes.find((l) => l.key === d.key);
  if (!me) return null;
  const n = lanes.length;
  const earlierBelow = lanes.filter((l) => l.arrival < me.arrival && l.rank > me.rank);
  const laterAbove = lanes.filter((l) => l.arrival > me.arrival && l.rank < me.rank);
  const why = (a: Lane, b: Lane) => (a.ready !== b.ready ? (a.ready ? `${a.id} has a ready site` : `${b.id} has a ready site`) : a.score !== b.score ? `score ${a.score ?? "–"} vs ${b.score ?? "–"}` : a.invest !== b.invest ? "larger investment" : "earlier application");
  const headline = `Arrived ${ord(me.arrival)} of ${n}, ranks ${ord(me.rank)}.`;
  let detail: string;
  if (me.rank < me.arrival) {
    const x = earlierBelow[0];
    detail = `A stronger application moves ahead of earlier ones: ${me.id} beats ${earlierBelow.map((l) => l.id).slice(0, 3).join(", ")} who arrived first (${x ? why(me, x) : "higher in the rules"}).`;
  } else if (me.rank > me.arrival) {
    const x = laterAbove[0];
    detail = `${laterAbove.map((l) => l.id).slice(0, 3).join(", ")} arrived later but rank higher (${x ? why(x, me) : "higher in the rules"}). Arriving first does not outrank a ready site or a higher score.`;
  } else {
    detail = "Arrival and strength agree: nobody who came later ranks above, and nobody who came earlier ranks below.";
  }
  // a lower score can rank higher when the site is ready and this one is not yet: say so, and say where this one would land
  const readyOvertakers = lanes.filter((l) => l.rank < me.rank && l.ready && !me.ready && l.score !== null && me.score !== null && l.score < me.score);
  if (readyOvertakers.length) {
    const ifReady = [...group].sort((a, b) => compare(a.key === d.key ? { ...a, ready: true } : a, b.key === d.key ? { ...b, ready: true } : b));
    const k = ifReady.findIndex((x) => x.key === d.key) + 1;
    detail = `${readyOvertakers.map((l) => l.id).slice(0, 3).join(", ")} rank${readyOvertakers.length === 1 ? "s" : ""} above despite a lower score (${readyOvertakers[0].score} vs ${me.score}) because ${readyOvertakers.length === 1 ? "it has" : "they have"} a ready site and this application does not yet. Once the missing detail is fixed it would rank ${ord(k)} of ${n}.`;
  }
  const tie = lanes.find((l) => l.key !== me.key && l.ready === me.ready && l.score === me.score && l.invest === me.invest);
  if (tie) detail += ` ${tie.id} ties on site, score and investment, so the earlier application (${(tie.arrival < me.arrival ? tie : me).id}) wins.`;
  return { lanes, me, headline, detail };
}
