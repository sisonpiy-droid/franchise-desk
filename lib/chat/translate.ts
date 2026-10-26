// Post-check for translated answers: the model may reword, never change a fact.
// Every number and ID in the English answer must appear in the translation, and nothing new.

const TOKEN = /[A-Z]{2,4}-\d{1,5}|\d+(?:[.,]\d+)*/g;

export function factTokens(text: string): string[] {
  return (text.match(TOKEN) ?? []).map((t) => t.replace(/,/g, "")).sort();
}

/** True when the translation carries exactly the same numbers and IDs as the source. */
export function sameFacts(source: string, translated: string): boolean {
  const a = factTokens(source);
  const b = factTokens(translated);
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

export const TRANSLATE_SCHEMA = {
  type: "OBJECT",
  properties: { lines: { type: "ARRAY", items: { type: "STRING" } } },
  required: ["lines"],
} as const;

/** Languages the desk can write in, with their script and HTML language code. */
export const LANGUAGES = {
  Hindi: { script: "Devanagari", code: "hi" },
  Kannada: { script: "Kannada", code: "kn" },
  Marathi: { script: "Devanagari", code: "mr" },
  Tamil: { script: "Tamil", code: "ta" },
  Telugu: { script: "Telugu", code: "te" },
  Malayalam: { script: "Malayalam", code: "ml" },
  Gujarati: { script: "Gujarati", code: "gu" },
  Bengali: { script: "Bengali", code: "bn" },
  Punjabi: { script: "Gurmukhi", code: "pa" },
  Odia: { script: "Odia", code: "or" },
} as const;
export type TranslateLang = keyof typeof LANGUAGES;
export const isTranslateLang = (x: unknown): x is TranslateLang => typeof x === "string" && x in LANGUAGES;

const STATE_LANGUAGE: Record<string, string> = {
  karnataka: "Kannada", maharashtra: "Marathi", "tamil nadu": "Tamil", telangana: "Telugu", "andhra pradesh": "Telugu", kerala: "Malayalam",
  gujarat: "Gujarati", "west bengal": "Bengali", punjab: "Punjabi", odisha: "Odia",
};
/** The main local language of a state, or null where Hindi already covers it (or the state is unknown). */
export function stateLanguage(state: string | null | undefined): TranslateLang | null {
  const l = STATE_LANGUAGE[(state ?? "").trim().toLowerCase()];
  return isTranslateLang(l) ? l : null;
}

export function translatePrompt(lines: string[], lang: TranslateLang): string {
  return JSON.stringify({
    task: `Translate each line into simple ${lang} (${LANGUAGES[lang].script} script). Keep every number, ₹ amount, pin code and ID such as APP-007 or TER-02 exactly as written, in Western digits. Do not add, remove or change any fact. Return the same number of lines.`,
    lines,
  });
}
