# Anchor — NYC Housing Stability Guide

> Anchor turns a renter's story into one clear next step and a printable handoff to a human. Built for NYC tenants facing housing instability.

> **How it works in one line:**  Every fact Anchor states lives in `playbook.json` — every fact Anchor states lives there. The model doesn't invent facts; it classifies situations and routes users through verified content.

---

## What it does

Anchor is a triage tool, not a chatbot or a lawyer. A renter types or speaks what's happening. Anchor reads the situation, asks one high-leverage question, and returns a single most urgent action, a short plan, mistakes to avoid, and the verified people to call — plus a printable one-page summary that can be handed directly to a counselor.

The clearest example of its reasoning is the difference between a rent demand and a City Marshal's notice. A rent demand with no court date leads to: *"you likely have some time, start applying for rent help today."* A City Marshal's eviction notice for the same person returns *"time is very short, go to court today to ask for an Order to Show Cause."* Same problem category, different legal stage, completely different urgency.

## Live demo

- **Try it:** - [anchor-one-sigma.vercel.app](https://anchor-one-sigma.vercel.app/)

## The problem it solves

In 2024, more than 126,000 eviction cases were filed in New York City, the vast majority for nonpayment of rent. Tenant representation in housing court has fallen to 42% citywide and as low as 31% in the Bronx — most tenants face eviction without a lawyer. Yet 89% of tenants with full legal representation stay housed. The difference between keeping a home and losing one often comes down to whether someone reaches the right help in time. Anchor closes that gap at the first, most panicked moment.

## How it works

Anchor reasons in two passes over a verified playbook:

1. A deterministic **crisis filter** checks the raw input first. Crisis language (domestic violence, self-harm, nowhere to sleep tonight) bypasses all housing logic and routes to emergency resources.
2. **Pass one** matches the situation against an 11-entry verified playbook, identifies every issue present, ranks them by urgency (1–5), selects the most urgent as primary, names the rest as secondary, and surfaces the single highest-leverage question.
3. A **confidence gate** routes low-confidence input to a human helpline instead of forcing a plan.
4. A **backstop** re-scans the model's own stated understanding for crisis signals the keyword filter may have missed.
5. **Pass two** uses the user's answer to select the matching stage and builds a plan from that stage's verified content only.

## Evaluation

Validated across 25 labeled test cases spanning all 11 scenarios plus adversarial crisis inputs: 92% correct primary classification.

Bias testing: Anchor was tested across terse low-literacy input, African American Vernacular English, and mixed Spanish-English, and correctly interpreted non-standard grammar, routing each to the right situation. Ambiguous input routes to a human via the confidence gate.

## Responsible AI

- **Never authors legal facts.** All guidance comes from `playbook.json`, written from official NYC sources, each entry dated and cited and shown to the user.
- **Routes time-sensitive specifics to a verified human** rather than asserting them, because a wrong date can cost someone their home.
- **Crisis safety runs before housing logic**, with a deterministic filter plus a model-output backstop.
- **Uncertainty fails safe** toward a human via the confidence gate.
- Every screen states this is guidance, not legal advice.

## Tech stack

Next.js, React, TypeScript, Tailwind CSS, Google Gemini (gemini-2.5-flash with automatic fallback), Leaflet + OpenStreetMap, Web Speech API, Vercel.

Every component except the language-model calls runs at zero cost (no map API key, no billing; browser-native voice; free-tier hosting), so a nonprofit could operate Anchor for little more than cents-per-query inference.

## Data sources & verification

Anchor uses no scraped or synthetic legal content. Its 11-scenario playbook was written from official and legal-aid sources: the NY State Unified Court System, NYC HPD, NY State Homes & Community Renewal (DHCR), the NY State Attorney General's tenant guidance, and Housing Court Answers. The 13 resource locations (five borough Housing Courts with verified addresses, plus hotlines for tenant support, rental assistance, domestic violence, and shelter) were confirmed against official NYC listings. No personal data is collected or stored.

## Running locally

```bash
git clone https://github.com/faiha25/anchor
cd anchor
npm install
```

Create a file named `.env.local` in the project root with your Gemini API key:

​```
GEMINI_API_KEY=your_key_here
​```

Then:

```bash
npm run dev
```

Open http://localhost:3000

## Roadmap

- A document-type identifier (tells a user what kind of notice they hold, without reading sensitive details off it)
- Direct connections to volunteer housing counselors
- Multilingual support, starting with Spanish
- Expansion to NYCHA and public-housing situations

## Disclaimer

Anchor provides general information for New York City. It is **not legal advice**. Always confirm next steps with a qualified person before acting.
