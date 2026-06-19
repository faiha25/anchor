import { GoogleGenAI } from "@google/genai";
import playbook from "../../../playbook.json";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const CRISIS_TERMS = [
  "kill myself", "suicide", "end my life", "want to die", "can't go on", "cant go on",
  "hurt myself", "hurting myself", "harming myself", "harm myself", "no reason to live",
  "hit me", "hits me", "hitting me", "beat me", "beats me", "beating me",
  "hurts me", "hurt me", "abuses me", "abusing me", "abused me", "he hurts me", "she hurts me",
  "domestic violence", "afraid for my life", "scared for my life", "threatening to kill",
  "threatened to kill", "attacks me", "attacking me", "violent",
  "nowhere to sleep tonight", "sleeping on the street", "on the street tonight",
  "my kids and i have nowhere", "homeless tonight", "nowhere to go tonight",
];

const CRISIS_BACKSTOP_TERMS = [
  "domestic violence", "abuse", "abused", "abusive", "being hit", "being beaten",
  "suicide", "suicidal", "self-harm", "self harm", "harm themselves", "harm herself", "harm himself",
];

function containsAny(text: string, terms: string[]): boolean {
  const lower = (text || "").toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function isCrisis(text: string): boolean {
  return containsAny(text, CRISIS_TERMS);
}

function crisisResponse() {
  return Response.json({
    crisis: true,
    message:
      "It sounds like you may be in danger or in crisis. Please reach out to a person who can help right now.",
    resources: [
      "Call or text 988 (Suicide and Crisis Lifeline)",
      "If a partner or someone is hurting you: call the National Domestic Violence Hotline at 1-800-799-7233",
      "Call 911 if you are in immediate danger",
      "NYC: call 311 and ask for emergency housing help (Homebase)",
    ],
  });
}

function labelFor(key: string): string {
  const entry = (playbook as Record<string, any>)[key];
  return entry?.label ?? key;
}

function verifiedDate(situationKey: string): string | null {
  const entry = (playbook as Record<string, any>)[situationKey];
  return entry?.last_verified ?? null;
}

// Return a readable primary source and the trust tier for the matched entry.
function sourceInfo(situationKey: string): { primary: string | null; tier: number | null } {
  const entry = (playbook as Record<string, any>)[situationKey];
  if (!entry) return { primary: null, tier: null };
  const sources: string[] = Array.isArray(entry.sources) ? entry.sources : [];
  let primary = sources[0] ?? null;
  // Tidy a raw URL into something readable.
  if (primary && primary.startsWith("http")) {
    try {
      const host = new URL(primary.split(" ")[0]).host.replace(/^www\./, "");
      primary = host;
    } catch {
      // leave as-is
    }
  }
  return { primary, tier: entry.source_tier ?? null };
}

function buildQuestionPrompt(situation: string): string {
  return [
    "You are a calm housing triage assistant for New York City renters. You are NOT a lawyer.",
    "",
    "You will be given a person's description of their housing problem, and a PLAYBOOK of",
    "human-written, source-checked situations. You must ONLY use the playbook for any factual",
    "guidance. You must NOT invent laws, deadlines, rights, eligibility, or resources.",
    "",
    "SAFETY FIRST: If the person mentions being hurt, hit, threatened, or abused by anyone, or",
    "mentions self-harm or having nowhere to sleep tonight, set situation_key to 'CRISIS' and stop.",
    "Do not ask a housing question in that case.",
    "",
    "Otherwise, your job right now is ONLY to understand and ask. Do NOT build a plan yet.",
    "1. Read the person's situation carefully.",
    "2. Identify EVERY playbook situation that clearly applies. A person may have more than one.",
    "3. Choose the SINGLE most urgent one as the primary situation_key.",
    "4. List any OTHER clearly-applicable keys in secondary_keys (empty array if none).",
    "5. Give an urgency number from 1 (low) to 5 (emergency) for the primary situation.",
    "6. If nothing matches, set situation_key to 'none'.",
    "7. Reflect back what you understand, and surface the ONE highest-leverage question for the PRIMARY situation.",
    "8. Judge confidence. Use 'low' ONLY for genuinely vague input with no clear housing issue. If it clearly matches, use 'high'.",
    "",
    "Only include a key in secondary_keys if the person clearly describes that issue too. Do not pad.",
    "Keep language plain, warm, and free of legal jargon. Never mention being an AI.",
    "",
    "Return ONLY a JSON object, no markdown, no backticks, in exactly this shape:",
    '{',
    '  "situation_key": "the most urgent matching key, or none, or CRISIS",',
    '  "secondary_keys": ["other clearly-applicable keys, or empty"],',
    '  "urgency": 1,',
    '  "confidence": "high, medium, or low",',
    '  "match_reason": "one short plain sentence on why this is the primary match",',
    '  "reasoning": {',
    '    "what_i_understand": ["short plain points restating ONLY what the person said"],',
    '    "why_this_question": "one plain sentence on why this question matters most"',
    '  },',
    '  "the_one_question": {',
    '    "text": "the high_leverage_question text from the PRIMARY playbook entry",',
    '    "options": ["the options from that entry"]',
    '  }',
    '}',
    "",
    "If situation_key is none or CRISIS, set the_one_question to null and secondary_keys to an empty array.",
    "",
    "PLAYBOOK:",
    JSON.stringify(playbook, null, 2),
    "",
    "PERSON'S SITUATION:",
    '"' + situation + '"',
  ].join("\n");
}

function buildPlanPrompt(situation: string, question: string, answer: string): string {
  return [
    "You are a calm housing triage assistant for New York City renters. You are NOT a lawyer.",
    "",
    "Use ONLY the PLAYBOOK for factual guidance. Do NOT invent laws, deadlines, rights,",
    "eligibility, or resources.",
    "",
    "The person described their situation, you asked one question, and they answered.",
    "",
    "IMPORTANT: Some playbook entries have a 'stages' object. Each stage has a 'match' field",
    "describing an answer option. Find the stage whose 'match' best fits THEIR ANSWER below,",
    "and build the plan using ONLY that stage's content. Different answers MUST produce",
    "different plans. Do not blend stages. If the answer is 'SKIP', use the most cautious",
    "stage. If the entry has no 'stages', use its top-level steps.",
    "",
    "Rules you must never break:",
    "- Never state a specific legal deadline as fact. If timing matters, tell them to confirm with a human.",
    "- Never say a person qualifies for or has a right to anything.",
    "- Frame risky moves in terms of being hard to undo, and route to a human.",
    "- Keep language plain, warm, and free of legal jargon. Never mention being an AI.",
    "",
    "Return ONLY a JSON object, no markdown, no backticks, in exactly this shape:",
    '{',
    '  "situation_key": "the chosen playbook key",',
    '  "reasoning": {',
    '    "what_i_understand": ["short plain points, including what their answer told you"],',
    '    "why_this_question": "one plain sentence on why their answer shaped the plan"',
    '  },',
    '  "plan": {',
    '    "urgent": "the urgent text from the matched stage",',
    '    "next_48h": ["the next_48h items"],',
    '    "this_week": ["the this_week items"],',
    '    "mistakes": ["the mistakes items"],',
    '    "human": "the route_to_human text from the entry"',
    '  }',
    '}',
    "",
    "PLAYBOOK:",
    JSON.stringify(playbook, null, 2),
    "",
    "PERSON'S SITUATION:",
    '"' + situation + '"',
    "",
    "QUESTION YOU ASKED:",
    '"' + question + '"',
    "",
    "THEIR ANSWER (match this to a stage):",
    '"' + answer + '"',
  ].join("\n");
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callModelWithRetry(prompt: string): Promise<string> {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
  let lastError: unknown = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await ai.models.generateContent({ model, contents: prompt });
        return result.text ?? "";
      } catch (err) {
        lastError = err;
        await wait(800 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const situation: string = body.situation ?? "";
    const question: string = body.question ?? "";
    const answer: string = body.answer ?? "";

    if (isCrisis(situation) || isCrisis(answer)) {
      return crisisResponse();
    }

    const prompt = answer
      ? buildPlanPrompt(situation, question, answer)
      : buildQuestionPrompt(situation);

    const raw = await callModelWithRetry(prompt);
    const cleaned = raw.replace(/[`]{3}json/g, "").replace(/[`]{3}/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json({
        crisis: false,
        situation_key: "none",
        fallback: true,
        message:
          "We could not build a structured plan for this. Please contact the NYC Tenant Helpline by calling 311 and saying 'Tenant Helpline'.",
      });
    }

    const modelText = JSON.stringify(parsed.reasoning ?? "") + " " + (parsed.match_reason ?? "");
    if (parsed.situation_key === "CRISIS" || containsAny(modelText, CRISIS_BACKSTOP_TERMS)) {
      return crisisResponse();
    }

    if (!answer && parsed.confidence === "low") {
      return Response.json({
        crisis: false,
        fallback: true,
        lowConfidence: true,
        message:
          "Your situation may need a person to look at it directly. The best next step is free guidance — call 311 and say 'Tenant Helpline', or call Housing Court Answers at 212-962-4795.",
      });
    }

    let secondaryLabels: string[] = [];
    if (!answer && Array.isArray(parsed.secondary_keys)) {
      secondaryLabels = parsed.secondary_keys
        .filter((k: string) => k && k !== parsed.situation_key)
        .map((k: string) => labelFor(k));
    }

    const verified = verifiedDate(parsed.situation_key);
    const source = sourceInfo(parsed.situation_key);

    return Response.json({
      crisis: false,
      phase: answer ? "plan" : "question",
      verified,
      secondaryLabels,
      source,
      ...parsed,
    });
  } catch (err) {
    console.error("Triage error:", err);
    return Response.json({
      crisis: false,
      fallback: true,
      message:
        "Something went wrong. Please call 311 and say 'Tenant Helpline' for free guidance.",
    });
  }
}