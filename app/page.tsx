'use client';

import { useState } from 'react';

export default function Home() {
  const [screen, setScreen] = useState('dump');
  const [situation, setSituation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  // First call: situation only. Returns the question.
  async function submitSituation() {
    if (!situation.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation }),
      });
      const data = await res.json();
      setResult(data);

      if (data.crisis) setScreen('crisis');
      else if (data.fallback || data.situation_key === 'none') setScreen('fallback');
      else setScreen('question');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Second call: situation + their answer. Returns the refined plan.
  async function submitAnswer(answer: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          situation,
          question: result?.the_one_question?.text ?? '',
          answer,
        }),
      });
      const data = await res.json();
      setResult(data);

      if (data.crisis) setScreen('crisis');
      else if (data.fallback || data.situation_key === 'none') setScreen('fallback');
      else setScreen('plan');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setSituation('');
    setResult(null);
    setError('');
    setScreen('dump');
  }

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <>
      <main className="app-view min-h-screen w-full flex justify-center bg-canvas">
        <div className="w-full max-w-[30rem] px-6 pt-20 pb-12 flex flex-col min-h-screen">

          {/* SCREEN: DUMP */}
          {screen === 'dump' && (
            <div className="anchor-enter flex flex-col flex-1">
              <p className="text-[0.95rem] font-medium tracking-tight text-ink">Anchor</p>
              <div className="mt-16">
                <h1 className="text-[1.4rem] leading-snug font-normal text-ink">
                  What&apos;s happening with your housing right now?
                </h1>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">
                  Say it however it comes out. There&apos;s no wrong way to start.
                </p>
                <textarea
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  placeholder="e.g. I got a paper on my door saying I have a few days, I have two kids…"
                  className="mt-6 w-full h-44 p-4 rounded-xl bg-surface border border-hairline text-[1.05rem] leading-relaxed resize-none transition-colors focus:border-accent focus:outline-none placeholder:text-ink-soft"
                />
                {error && <p className="mt-3 text-[0.9rem] text-caution">{error}</p>}
              </div>
              <div className="mt-auto pt-10">
                <button
                  onClick={submitSituation}
                  disabled={loading}
                  className="w-full bg-accent text-white py-4 rounded-xl text-[1.05rem] font-medium transition-colors hover:bg-accent-ink disabled:opacity-60"
                >
                  {loading ? 'Reading what you wrote…' : 'See what\u2019s most urgent'}
                </button>
                <p className="mt-5 text-[0.8rem] leading-relaxed text-center text-ink-soft">
                  General information for New York City, not legal advice.
                  Always confirm with a person before acting.
                </p>
              </div>
            </div>
          )}

          {/* SCREEN: QUESTION (seen first, then asked) */}
          {screen === 'question' && result && (
            <div className="anchor-enter flex flex-col flex-1">
              <div>
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-soft mb-2">
                  What I understand so far
                </p>
                <ul className="space-y-1.5 text-ink text-[0.98rem] leading-relaxed mb-8">
                  {result.reasoning?.what_i_understand?.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>

                <p className="text-[0.9rem] leading-relaxed text-ink-soft mb-6">
                  {result.reasoning?.why_this_question}
                </p>

                <h2 className="text-[1.2rem] leading-snug font-semibold text-ink mb-5">
                  {result.the_one_question?.text}
                </h2>

                <div className="space-y-3">
                  {result.the_one_question?.options?.map((opt: string, i: number) => (
                    <button
                      key={i}
                      onClick={() => submitAnswer(opt)}
                      disabled={loading}
                      className="w-full text-left px-4 py-4 rounded-xl bg-surface border border-hairline text-[1rem] leading-relaxed text-ink transition-colors hover:border-accent hover:bg-accent-tint disabled:opacity-60"
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                {loading && (
                  <p className="mt-6 text-[0.9rem] text-ink-soft">Putting your plan together…</p>
                )}
                {error && <p className="mt-4 text-[0.9rem] text-caution">{error}</p>}
              </div>

              <div className="mt-auto pt-10">
                <button
                  onClick={reset}
                  className="w-full py-3.5 rounded-xl border border-hairline text-ink-soft text-[0.98rem] transition-colors hover:bg-surface"
                >
                  Start over
                </button>
              </div>
            </div>
          )}

          {/* SCREEN: PLAN */}
          {screen === 'plan' && result && (
            <div className="anchor-enter">
              <div className="text-[0.95rem] leading-relaxed">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-soft mb-2">
                  What I understand so far
                </p>
                <ul className="space-y-1.5 text-ink mb-8">
                  {result.reasoning?.what_i_understand?.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-urgent-tint p-5 mb-8 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-urgent mb-2">
                  Most urgent
                </p>
                <p className="text-[1.35rem] leading-snug font-semibold text-ink">
                  {result.plan?.urgent}
                </p>
              </div>

              <div className="mb-7">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-soft mb-3">
                  Next 48 hours
                </p>
                <ul className="space-y-2.5">
                  {result.plan?.next_48h?.map((item: string, i: number) => (
                    <li key={i} className="text-[0.98rem] leading-relaxed pl-4 relative text-ink">
                      <span className="absolute left-0 text-ink-soft">·</span>{item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-7">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-soft mb-3">
                  This week
                </p>
                <ul className="space-y-2.5">
                  {result.plan?.this_week?.map((item: string, i: number) => (
                    <li key={i} className="text-[0.98rem] leading-relaxed pl-4 relative text-ink">
                      <span className="absolute left-0 text-ink-soft">·</span>{item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-caution-tint border border-[#EBD9D5] p-5 mb-7">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-caution mb-3">
                  Mistakes to avoid right now
                </p>
                <ul className="space-y-3">
                  {result.plan?.mistakes?.map((item: string, i: number) => (
                    <li key={i} className="text-[0.95rem] leading-relaxed text-ink">{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-accent-tint p-5 mb-8">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-accent mb-2">
                  Who to take this to
                </p>
                <p className="text-[0.95rem] leading-relaxed text-ink">{result.plan?.human}</p>
              </div>

              <button
                onClick={() => window.print()}
                className="w-full bg-accent text-white py-4 rounded-xl text-[1.05rem] font-medium transition-colors hover:bg-accent-ink mb-4"
              >
                Make a summary I can take to someone
              </button>

              <p className="text-[0.8rem] leading-relaxed text-center text-ink-soft mb-6">
                General information for New York City, not legal advice.
                Always confirm with a person before acting.
              </p>

              <button
                onClick={reset}
                className="w-full py-3.5 rounded-xl border border-hairline text-ink-soft text-[0.98rem] transition-colors hover:bg-surface"
              >
                Start over
              </button>
            </div>
          )}

          {/* SCREEN: CRISIS */}
          {screen === 'crisis' && result && (
            <div className="anchor-enter flex flex-col flex-1 justify-center">
              <div className="rounded-2xl bg-accent-tint p-6 mb-8">
                <p className="text-[1.1rem] leading-relaxed font-medium text-ink mb-5">{result.message}</p>
                <ul className="space-y-3">
                  {result.resources?.map((item: string, i: number) => (
                    <li key={i} className="text-[1rem] font-medium text-accent-ink">{item}</li>
                  ))}
                </ul>
              </div>
              <button
                onClick={reset}
                className="w-full py-3.5 rounded-xl border border-hairline text-ink-soft text-[0.98rem] transition-colors hover:bg-surface"
              >
                Start over
              </button>
            </div>
          )}

          {/* SCREEN: FALLBACK */}
          {screen === 'fallback' && result && (
            <div className="anchor-enter flex flex-col flex-1 justify-center">
              <div className="rounded-2xl bg-surface border border-hairline p-6 mb-8">
                <p className="text-[1.05rem] leading-relaxed text-ink">{result.message}</p>
              </div>
              <button
                onClick={reset}
                className="w-full py-3.5 rounded-xl border border-hairline text-ink-soft text-[0.98rem] transition-colors hover:bg-surface"
              >
                Start over
              </button>
            </div>
          )}

        </div>
      </main>

      {/* PRINT-ONLY CASE FILE */}
      {screen === 'plan' && result && (
        <div className="case-file text-slate-900 max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-1">Housing Situation Summary</h1>
          <p className="text-sm text-slate-500 mb-6">Prepared with Anchor on {today}. General information for NYC, not legal advice.</p>
          <h2 className="text-base font-semibold border-b border-slate-300 pb-1 mb-2">In their own words</h2>
          <p className="text-sm mb-5 italic">&ldquo;{situation}&rdquo;</p>
          <h2 className="text-base font-semibold border-b border-slate-300 pb-1 mb-2">What this appears to be</h2>
          <ul className="list-disc list-inside text-sm mb-5">
            {result.reasoning?.what_i_understand?.map((item: string, i: number) => (<li key={i}>{item}</li>))}
          </ul>
          <h2 className="text-base font-semibold border-b border-slate-300 pb-1 mb-2">Most urgent action</h2>
          <p className="text-sm mb-5">{result.plan?.urgent}</p>
          <h2 className="text-base font-semibold border-b border-slate-300 pb-1 mb-2">Next 48 hours</h2>
          <ul className="list-disc list-inside text-sm mb-5">
            {result.plan?.next_48h?.map((item: string, i: number) => (<li key={i}>{item}</li>))}
          </ul>
          <h2 className="text-base font-semibold border-b border-slate-300 pb-1 mb-2">This week</h2>
          <ul className="list-disc list-inside text-sm mb-5">
            {result.plan?.this_week?.map((item: string, i: number) => (<li key={i}>{item}</li>))}
          </ul>
          <h2 className="text-base font-semibold border-b border-slate-300 pb-1 mb-2">Mistakes to avoid</h2>
          <ul className="list-disc list-inside text-sm mb-5">
            {result.plan?.mistakes?.map((item: string, i: number) => (<li key={i}>{item}</li>))}
          </ul>
          <h2 className="text-base font-semibold border-b border-slate-300 pb-1 mb-2">Who to take this to</h2>
          <p className="text-sm mb-5">{result.plan?.human}</p>
          <p className="text-xs text-slate-400 mt-8 border-t border-slate-300 pt-3">
            This summary was generated to help organize a housing situation. It is general information for New York City, not legal advice. Always confirm next steps with a qualified person before acting.
          </p>
        </div>
      )}
    </>
  );
}
