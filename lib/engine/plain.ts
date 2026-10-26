// Plain-English verdict for one decision: a short word, a one-sentence reason a non-expert can read, and the next step.
// Built only from fields the engine already decided (status, reason code, score, funds, pin, rank). The engine's own
// technical sentence (`d.why`) is kept for the evidence view; nothing here changes a decision.
import type { Decision, Status } from "./types";

export const VERDICT_WORD: Record<Status, string> = {
  APPROVED: "Approved",
  CONDITIONAL: "Approved, with a condition",
  WAITLISTED: "On the waiting list",
  ON_HOLD: "On hold: we need information",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

/** One short noun phrase for lists and badges. */
export const VERDICT_SHORT: Record<Status, string> = {
  APPROVED: "Approved",
  CONDITIONAL: "Conditional",
  WAITLISTED: "Waiting list",
  ON_HOLD: "On hold",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

const lakh = (n: number) => `₹${Math.round(n * 10) / 10} lakh`;

/** The reason in one plain sentence. Falls back to the engine's own sentence when no plain wording exists. */
export function plainReason(d: Decision): string {
  const code = d.codes[0];
  const pin = d.allocatedPin ?? d.pin;
  const t = d.territoryId ?? "this territory";
  const cx = d.capex;
  const short = cx && cx.invest !== null ? cx.required - cx.invest : null;
  const stripped = d.why.replace(/^[^:]+:\s*/, "");
  switch (d.status) {
    case "APPROVED": {
      const bits = [d.score ? `scored ${d.score.total} out of 100` : null, cx && cx.invest !== null ? `has ${lakh(cx.invest)} against the ${lakh(cx.required)} needed` : null, pin ? `pincode ${pin} is free` : null].filter(Boolean);
      return `Strong application: ${bits.join(", ")}.`;
    }
    case "CONDITIONAL":
      return d.allocatedPin ? `We have reserved pincode ${d.allocatedPin} for them, but something must be checked first.` : `We have reserved a slot for them in ${t}, but they still need a site that qualifies.`;
    case "WAITLISTED":
      if (code === "PIN_TAKEN") return `Another applicant scored higher for pincode ${pin}, and we allow only one store per pincode.`;
      if (code === "SLOTS_FULL") return `Every open slot in ${t} went to a higher-ranked applicant.`;
      if (code === "BELOW_BAR") return `The score of ${d.score?.total ?? "?"} is below the bar of ${d.bar ?? "?"} for ${t}.`;
      return stripped;
    case "ON_HOLD":
      switch (code) {
        case "PIN_HAS_STORE":
          return `Our own store already operates in pincode ${pin}, and we allow only one store per pincode.`;
        case "PIN_MISSING":
        case "PIN_INVALID":
          return "The pincode is missing or is not a valid 6-digit pincode.";
        case "CITY_PIN_MISMATCH":
          return "The city and the pincode do not match.";
        case "FUNDING_GAP":
          return short !== null && short > 0 ? `Their funds are ${lakh(short)} short of the ${lakh(cx!.required)} this store is estimated to cost.` : "Their funds are slightly short of the estimated cost.";
        case "UNIT_ERROR":
          return "The investment amount looks like rupees written where lakh was expected.";
        case "SPACE_SIZE_MISSING":
        case "SPACE_CONTRADICTION":
        case "FLOOR_UNKNOWN":
        case "SPACE_SMALL":
          return "The details about their shop space are missing, unclear or too small.";
        case "NOTE_CONFLICT":
        case "EXPERIENCE_CONFLICT":
          return "Two things they told us do not agree with each other.";
        case "LOAN_DEPENDENT":
        case "COMPLIANCE_CUE":
        case "CAPACITY_OUTLIER":
          return "Their funding needs a document check before we can go ahead.";
        case "SAME_PROPERTY_CLAIM":
        case "FUZZY_IDENTITY":
        case "SLOT_SQUATTING":
        case "WEAK_TITLE":
          return "We need to check ownership or identity before we can approve.";
        default:
          return stripped;
      }
    case "DECLINED":
      switch (code) {
        case "OUT_OF_TERRITORY":
          return `Pincode ${pin} is outside every territory where we are opening stores.`;
        case "INVEST_LOW":
          return cx && cx.invest !== null ? `Their funds of ${lakh(cx.invest)} are far below the ${lakh(cx.required)} this store is estimated to cost.` : "Their funds are far below the estimated cost.";
        case "PIN_HAS_STORE_NO_ALT":
          return "We already have a store at this pincode and the area has no other free pincode.";
        case "BELOW_BAR":
          return `The score of ${d.score?.total ?? "?"} is below our minimum.`;
        default:
          return stripped;
      }
    default:
      return stripped;
  }
}

/** The one thing that would move this applicant forward, in plain words, or null when nothing is asked. */
export function plainNext(d: Decision): { text: string; owner: string } {
  return { text: d.nextStep, owner: d.owner };
}
