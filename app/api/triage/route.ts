import { GoogleGenAI } from "@google/genai";
import playbook from "../../../playbook.json";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const CRISIS_TERMS = [
  "kill myself", "suicide", "end my life", "want to die", "can't go on",
  "hurt myself", "harming myself", "no reason to live",
  "hit me", "beating me", "abusing me", "he hurts me", "she hurts me",
  "domestic violence", "afraid for my life", "threatening to kill",
  "nowhere to sleep tonight", "sleeping on the street", "on the street tonight",
  "my kids and i have nowhere", "homeless tonight",
];

function isCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_TERMS.some((term) => lower.includes(term));
}

// FIRST CALL: situation only. Return reasoning + the question + a confidence score. No plan yet.
function buildQuestionPrompt(situation: string): string {
  return [
    "You are a calm housing triage assistant for New York City renters. You are NOT a lawyer.",
    "",
    "You will be given a person's description of their housing problem, and a PLAYBOOK of",
    "human-written, source-checked situations. You must ONLY use the playbook for any factual",
    "guidance. You must NOT invent laws, deadlines, rights, eligibility, or resources.",
    "",
    "Your job right now is ONLY to understand and ask. Do NOT build a plan yet.",
    "1. Read the person's situation.",
    "2. Choose the SINGLE best-matching playbook situation by its key.",
    "3. If nothing matches, set situation_key to 'none'.",
    "4. Reflect back what you understand, and surface the ONE highest-leverage question.",
    "5. Judge how confident you are. If the situation is vague, mixed, or only loosely matches, say 'low'. Be honest about uncertainty rather than forcing a match.",
    "",
    "Keep language plain, warm, and free of legal jargon. Never mention being an AI.",
    "",
    "Return ONLY a JSON object, no markdown, no backticks, in exactly this shape:",
    '{',
    '  "situation_key": "the chosen playbook key, or none",',
    '  "confidence": "high, medium, or low — how well the situation matches a playbook entry",',
    '  "match_reason": "one short plain sentence on why you chose this match",',
    '  "reasoning": {',
    '    "what_i_understand": ["short plain points about their situation"],',
    '    "why_this_question": "one plain sentence on why this question matters most"',
    '  },',
    '  "the_one_question": {',
    '    "text": "the high_leverage_question text from the chosen playbook entry",',
    '    "options": ["the options from that entry"]',
    '  }',
    '}',
    "",
    "If situation_key is none, set the_one_question to null.",
    "",
    "PLAYBOOK:",
    JSON.stringify(playbook, null, 2),
    "",
    "PERSON'S SITUATION:",
    '"' + situation + '"',
  ].join("\n");
}

// SECOND CALL: situation + their answer. Build the full plan using the MATCHING STAGE.
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
    "describing an answer option. You MUST find the stage whose 'match' best fits THEIR ANSWER",
    "below, and build the plan using ONLY that stage's content (its urgent, next_48h, this_week,",
    "and mistakes). Different answers MUST produce different plans. Do not blend stages.",
    "If the matched entry has no 'stages' object, use its top-level steps instead.",
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
    '  "matched_stage": "the stage key you used, or none if the entry had no stages",',
    '  "reasoning": {',
    '    "what_i_understand": ["short plain points, including what their answer told you"],',
    '    "why_this_question": "one plain sentence on why their answer changed the plan"',
    '  },',
    '  "plan": {',
    '    "urgent": "the urgent text from the matched stage",',
    '    "next_48h": ["the next_48h items from the matched stage"],',
    '    "this_week": ["the this_week items from the matched stage"],',
    '    "mistakes": ["the mistakes items from the matched stage"],',
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
      return Response.json({
        crisis: true,
        message:
          "It sounds like you may be in danger or in crisis. Please reach out to a person who can help right now.",
        resources: [
          "Call or text 988 (Suicide and Crisis Lifeline)",
          "Call 911 if you are in immediate danger",
          "NYC: call 311 and ask for emergency housing help (Homebase)",
        ],
      });
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

    if (!answer && parsed.confidence === "low") {
      return Response.json({
        crisis: false,
        fallback: true,
        lowConfidence: true,
        message:
          "Your situation may need a person to look at it directly. The best next step is free guidance — call 311 and say 'Tenant Helpline', or call Housing Court Answers at 212-962-4795.",
      });
    }

    return Response.json({ crisis: false, phase: answer ? "plan" : "question", ...parsed });
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