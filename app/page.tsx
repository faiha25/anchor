'use client';

import { useState, useRef, useEffect } from 'react';
import Resources from './Resources';

function PhoneLink({ number, children }: { number: string; children: React.ReactNode }) {
  return (
    <a href={`tel:${number}`} className="underline decoration-from-font underline-offset-2">
      {children}
    </a>
  );
}

// Finds phone numbers (formatted or the bare "311") inside text and makes them tap-to-dial.
function linkifyPhones(text: string): React.ReactNode {
  if (!text) return text;
  // Matches 1-800-799-7233, 718-557-1399, 212-962-4795, and standalone 311.
  const pattern = /(\b1?[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{4}\b|\b311\b)/g;
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (pattern.test(part)) {
      pattern.lastIndex = 0; // reset because we reuse the regex
      const tel = part.replace(/[^0-9]/g, '');
      return (
        <a key={i} href={`tel:${tel}`} className="text-accent font-medium underline underline-offset-2">
          {part}
        </a>
      );
    }
    return part;
  });
}

function HumanRail() {
  return (
    <div className="mb-6 text-[0.8rem] text-ink-soft">
      Need a person now?{' '}
      <a href="tel:311" className="text-accent font-medium underline underline-offset-2">
        Call 311
      </a>{' '}
      and say &ldquo;Tenant Helpline&rdquo;.
    </div>
  );
}

function SeverityBadge({ urgency }: { urgency: number }) {
  const levels: Record<number, { label: string; cls: string }> = {
    1: { label: 'General — plan ahead', cls: 'bg-accent-tint text-accent' },
    2: { label: 'Act soon', cls: 'bg-accent-tint text-accent' },
    3: { label: 'Time-sensitive', cls: 'bg-urgent-tint text-urgent' },
    4: { label: 'Urgent', cls: 'bg-urgent-tint text-urgent' },
    5: { label: 'Emergency — act today', cls: 'bg-caution-tint text-caution' },
  };
  const lvl = levels[urgency] ?? levels[3];
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-[0.75rem] font-semibold uppercase tracking-wide ${lvl.cls}`}>
      {lvl.label}
    </span>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke={active ? 'var(--color-caution)' : 'currentColor'} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

export default function Home() {
  const [screen, setScreen] = useState('dump');
  const [situation, setSituation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [speaking, setSpeaking] = useState(false);

  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) setVoiceSupported(true);
  }, []);

  function toggleListening() {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (transcript) {
        setSituation((prev) => (prev ? prev + ' ' + transcript : transcript));
      }
    };
    recognition.onerror = () => { setListening(false); };
    recognition.onend = () => { setListening(false); };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  async function submitSituation() {
    if (!situation.trim()) return;
    if (listening) { recognitionRef.current?.stop(); setListening(false); }
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
    stopSpeaking();
    if (listening) { recognitionRef.current?.stop(); setListening(false); }
    setSituation('');
    setResult(null);
    setError('');
    setScreen('dump');
  }

  function readPlanAloud() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (speaking) { stopSpeaking(); return; }
    const p = result?.plan;
    if (!p) return;
    const parts = [
      'Most urgent.', p.urgent,
      'Next 48 hours.', ...(p.next_48h ?? []),
      'This week.', ...(p.this_week ?? []),
      'Who to take this to.', p.human,
    ].filter(Boolean);
    const utt = new SpeechSynthesisUtterance(parts.join(' '));
    utt.rate = 0.95;
    utt.onend = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
    setSpeaking(true);
  }
  function stopSpeaking() {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  function formatVerified(v: string | null | undefined): string | null {
    if (!v) return null;
    const [year, month] = v.split('-');
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const mi = parseInt(month, 10) - 1;
    if (mi < 0 || mi > 11) return null;
    return `${months[mi]} ${year}`;
  }
  const verifiedLabel = formatVerified(result?.verified);
  const secondaryLabels: string[] = Array.isArray(result?.secondaryLabels) ? result.secondaryLabels : [];
  const urgency: number = typeof result?.urgency === 'number' ? result.urgency : 0;
  const sourcePrimary: string | null = result?.source?.primary ?? null;

  return (
    <>
      <main className="app-view min-h-screen w-full flex justify-center bg-canvas">
        <div className="w-full max-w-[30rem] px-6 pt-12 pb-12 flex flex-col min-h-screen">

          <HumanRail />

          {/* SCREEN: DUMP */}
          {screen === 'dump' && (
            <div className="anchor-enter flex flex-col flex-1">
              <p className="text-[0.95rem] font-medium tracking-tight text-ink">Anchor</p>
              <div className="mt-12">
                <h1 className="text-[1.4rem] leading-snug font-normal text-ink">
                  What&apos;s happening with your housing right now?
                </h1>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">
                  Say it however it comes out. There&apos;s no wrong way to start.
                </p>

                <div className="relative mt-6">
                  <textarea
                    value={situation}
                    onChange={(e) => setSituation(e.target.value)}
                    placeholder="e.g. I got a paper on my door saying I have a few days, I have two kids..."
                    className="w-full h-44 p-4 pr-12 rounded-xl bg-surface border border-hairline text-[1.05rem] leading-relaxed resize-none transition-colors focus:border-accent focus:outline-none placeholder:text-ink-soft"
                  />
                  {voiceSupported && (
                    <button
                      onClick={toggleListening}
                      aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                      className={`absolute top-3 right-3 p-2 rounded-lg transition-colors ${listening ? 'bg-caution-tint text-caution' : 'text-ink-soft hover:bg-accent-tint hover:text-accent'}`}
                    >
                      <MicIcon active={listening} />
                    </button>
                  )}
                </div>
                {listening && (
                  <p className="mt-2 text-[0.82rem] text-caution">Listening... tap the mic again when you finish.</p>
                )}
                {error && <p className="mt-3 text-[0.9rem] text-caution">{error}</p>}
              </div>
              <div className="mt-auto pt-10">
                <button
                  onClick={submitSituation}
                  disabled={loading}
                  className="w-full bg-accent text-white py-4 rounded-xl text-[1.05rem] font-medium transition-colors hover:bg-accent-ink disabled:opacity-60"
                >
                  {loading ? 'Reading what you wrote...' : 'See what is most urgent'}
                </button>
                <p className="mt-4 text-[0.78rem] leading-relaxed text-center text-ink-soft">
                  Anchor covers common NYC renter situations. It doesn&apos;t yet cover NYCHA / public housing
                  rules or non-NYC areas. For those, it points you to the right human.
                </p>
                <p className="mt-3 text-[0.8rem] leading-relaxed text-center text-ink-soft">
                  General information for New York City, not legal advice.
                  Always confirm with a person before acting.
                </p>
              </div>
            </div>
          )}

          {/* SCREEN: QUESTION */}
          {screen === 'question' && result && (
            <div className="anchor-enter flex flex-col flex-1">
              <div>
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-soft mb-2">
                  What I understand so far
                </p>
                <ul className="space-y-1.5 text-ink text-[0.98rem] leading-relaxed mb-6">
                  {result.reasoning?.what_i_understand?.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>

                {secondaryLabels.length > 0 && (
                  <div className="rounded-xl bg-accent-tint p-4 mb-6">
                    <p className="text-[0.9rem] leading-relaxed text-ink">
                      You also mentioned{' '}
                      <span className="font-medium">{secondaryLabels.join(', ')}</span>.
                      Let&apos;s handle the most urgent thing first. You can come back for the rest after.
                    </p>
                  </div>
                )}

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
                  <p className="mt-6 text-[0.9rem] text-ink-soft">Putting your plan together...</p>
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
              <div className="flex items-center justify-between mb-6">
                {urgency > 0 ? <SeverityBadge urgency={urgency} /> : <span />}
                <button
                  onClick={readPlanAloud}
                  className="text-[0.85rem] text-accent font-medium underline underline-offset-2"
                >
                  {speaking ? 'Stop reading' : 'Read this aloud'}
                </button>
              </div>

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
                  {linkifyPhones(result.plan?.urgent)}
                </p>
              </div>

              <div className="mb-7">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-ink-soft mb-3">
                  Next 48 hours
                </p>
                <ul className="space-y-2.5">
                  {result.plan?.next_48h?.map((item: string, i: number) => (
                    <li key={i} className="text-[0.98rem] leading-relaxed pl-4 relative text-ink">
                      <span className="absolute left-0 text-ink-soft">-</span>{linkifyPhones(item)}
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
                      <span className="absolute left-0 text-ink-soft">-</span>{linkifyPhones(item)}
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
                    <li key={i} className="text-[0.95rem] leading-relaxed text-ink">{linkifyPhones(item)}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-accent-tint p-5 mb-6">
                <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-accent mb-2">
                  Who to take this to
                </p>
                <p className="text-[0.95rem] leading-relaxed text-ink">{linkifyPhones(result.plan?.human)}</p>
              </div>

              <Resources situationKey={result.situation_key} />

              {secondaryLabels.length > 0 && (
                <div className="rounded-xl border border-hairline p-4 mb-6">
                  <p className="text-[0.9rem] leading-relaxed text-ink-soft">
                    When you&apos;re ready, you can come back and start over for:{' '}
                    <span className="font-medium text-ink">{secondaryLabels.join(', ')}</span>.
                  </p>
                </div>
              )}

              {(verifiedLabel || sourcePrimary) && (
                <p className="text-[0.8rem] text-ink-soft mb-8">
                  {verifiedLabel ? `NYC tenant information, verified ${verifiedLabel}.` : ''}
                  {sourcePrimary ? ` Based on: ${sourcePrimary}.` : ''}
                </p>
              )}

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
              <div className="rounded-2xl bg-accent-tint p-6 mb-6">
                <p className="text-[1.1rem] leading-relaxed font-medium text-ink mb-5">{result.message}</p>
                <ul className="space-y-3">
                  {result.resources?.map((item: string, i: number) => (
                    <li key={i} className="text-[1rem] font-medium text-accent-ink">{linkifyPhones(item)}</li>
                  ))}
                </ul>
                <p className="mt-5 text-[0.95rem] text-ink">
                  Tap to call:{' '}
                  <PhoneLink number="988"><span className="text-accent font-medium">988</span></PhoneLink>
                  {' - '}
                  <PhoneLink number="18007997233"><span className="text-accent font-medium">1-800-799-7233</span></PhoneLink>
                  {' - '}
                  <PhoneLink number="911"><span className="text-accent font-medium">911</span></PhoneLink>
                </p>
              </div>
              <Resources situationKey="_crisis" />
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
                <p className="text-[1.05rem] leading-relaxed text-ink mb-4">{linkifyPhones(result.message)}</p>
                <p className="text-[0.95rem] text-ink">
                  Tap to call:{' '}
                  <PhoneLink number="311"><span className="text-accent font-medium">311</span></PhoneLink>
                  {' - '}
                  <PhoneLink number="2129624795"><span className="text-accent font-medium">212-962-4795</span></PhoneLink>
                </p>
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
          <p className="text-sm text-slate-500 mb-6">
            Prepared with Anchor on {today}.
            {verifiedLabel ? ` NYC tenant information verified ${verifiedLabel}.` : ''}
            {sourcePrimary ? ` Based on: ${sourcePrimary}.` : ''}
            {' '}General information for NYC, not legal advice.
          </p>
          <h2 className="text-base font-semibold border-b border-slate-300 pb-1 mb-2">In their own words</h2>
          <p className="text-sm mb-5 italic">&ldquo;{situation}&rdquo;</p>
          <h2 className="text-base font-semibold border-b border-slate-300 pb-1 mb-2">What this appears to be</h2>
          <ul className="list-disc list-inside text-sm mb-5">
            {result.reasoning?.what_i_understand?.map((item: string, i: number) => (<li key={i}>{item}</li>))}
          </ul>
          {secondaryLabels.length > 0 && (
            <>
              <h2 className="text-base font-semibold border-b border-slate-300 pb-1 mb-2">Other issues also mentioned</h2>
              <p className="text-sm mb-5">{secondaryLabels.join(', ')}</p>
            </>
          )}
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