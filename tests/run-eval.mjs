// Anchor classification eval harness.
import fs from "fs";

const cases = JSON.parse(fs.readFileSync(new URL("./eval-cases.json", import.meta.url)));
const ENDPOINT = "http://localhost:3000/api/triage";

let pass = 0;
const misses = [];

console.log(`\nRunning ${cases.length} classification tests...\n`);

for (const c of cases) {
  let result;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ situation: c.input }),
    });
    result = await res.json();
  } catch (err) {
    misses.push({ input: c.input, expected: c.expect, got: "REQUEST_FAILED" });
    continue;
  }

  let actual;
  if (result.crisis) actual = "CRISIS";
  else if (result.fallback || result.lowConfidence || result.situation_key === "none") actual = "LOW_OR_NONE";
  else actual = result.situation_key;

  const ok = actual === c.expect;
  if (ok) {
    pass++;
  } else {
    misses.push({ input: c.input, expected: c.expect, got: actual });
  }

  process.stdout.write(ok ? "." : "X");

  await new Promise((r) => setTimeout(r, 4000));
}

const total = cases.length;
const accuracy = ((pass / total) * 100).toFixed(1);

console.log(`\n\n----------------------------------------`);
console.log(`Classification accuracy: ${pass}/${total} = ${accuracy}%`);
console.log(`----------------------------------------\n`);

if (misses.length) {
  console.log("Misses:\n");
  for (const m of misses) {
    console.log(`  input:    "${m.input}"`);
    console.log(`  expected: ${m.expected}`);
    console.log(`  got:      ${m.got}\n`);
  }
} else {
  console.log("Perfect score. Every case classified as expected.\n");
}