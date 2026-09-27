"use client";
import { useEffect, useMemo, useState } from "react";
import { OBJECTIVES } from "@/lib/game/rules";
import type { Difficulty, Objective } from "@/lib/game/types";
import { newSeed } from "@/lib/game/rng";
import { FEATURED_COUNTRIES, type CountryConfig, type StartYearCheck } from "@/lib/worldbank/package";
import { ATTRIBUTION, Button, Panel } from "./ui";
import { WorldMap } from "./WorldMap";

export function useCountries() {
  const [countries, setCountries] = useState<CountryConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/countries")
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error))))
      .then((d: { countries: CountryConfig[] }) => !cancelled && (setCountries(d.countries.sort((a, b) => a.name.localeCompare(b.name))), setError(null)))
      .catch((e) => !cancelled && setError(String(e.message ?? e)));
    return () => { cancelled = true; };
  }, [attempt]);
  return { countries, error, retry: () => setAttempt((a) => a + 1) };
}

const OBJECTIVE_ICON: Record<Objective, string> = { balanced: "⚖", growth: "⬈", quality: "✚", green: "❦" };

type Progress = { id: string; code: string; name: string; from: { year: number; value: number }; to: { year: number; value: number } };

/** Live World Bank evidence that humanity has solved hard problems before. */
function WorldProgress() {
  const [progress, setProgress] = useState<Progress[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/progress")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("unavailable"))))
      .then((d: { progress: Progress[] }) => !cancelled && setProgress(d.progress))
      .catch(() => !cancelled && setProgress([]));
    return () => { cancelled = true; };
  }, []);
  if (!progress?.length) return null;
  const line = (p: Progress) => {
    if (p.id === "infantMortality") return { big: `${Math.round((1 - p.to.value / p.from.value) * 100)}% fewer`, text: `babies dying in their first year: ${p.from.value.toFixed(0)} → ${p.to.value.toFixed(0)} per 1,000 births` };
    if (p.id === "lifeExpectancy") return { big: `+${(p.to.value - p.from.value).toFixed(1)} years`, text: `of life for the average person: ${p.from.value.toFixed(1)} → ${p.to.value.toFixed(1)}` };
    return { big: `${p.from.value.toFixed(0)}% → ${p.to.value.toFixed(0)}%`, text: "of people with electricity" };
  };
  return (
    <section className="animate-rise relative mt-12 w-full max-w-5xl rounded-2xl border border-good/30 bg-good/[0.06] p-6 text-left" style={{ animationDelay: "0.6s" }}>
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-good">Proof that change is possible · the whole world, World Bank data</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {progress.map((p) => {
          const l = line(p);
          return (
            <div key={p.id} className="rounded-lg bg-panel/60 p-4 text-center">
              <p className="font-display text-3xl text-good">{l.big}</p>
              <p className="mt-1 text-sm text-parchment/85">{l.text}</p>
              <p className="mt-1 font-mono text-[10px] text-muted">World Bank · {p.code} · {p.from.year} and {p.to.year}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-sm text-parchment/85">None of this happened by accident. It happened because people made choices: to vaccinate, to build, to educate, to connect.</p>
    </section>
  );
}

export function Landing({ onStart, onHowItWorks }: { onStart: () => void; onHowItWorks: () => void }) {
  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-6 pb-16 pt-14 text-center">
      <div className="pointer-events-none absolute inset-x-0 top-24 mx-auto max-w-6xl opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]">
        <WorldMap countries={[]} fill={() => "#1a212b"} height={480} />
      </div>
      <p className="animate-rise relative text-xs font-semibold uppercase tracking-[0.35em] text-brass/80">A strategy game of global development · AI for Social Good</p>
      <h1 className="animate-sweep relative mt-5 font-display text-5xl font-bold uppercase leading-tight text-parchment sm:text-7xl">Humanity&apos;s Next Move</h1>
      <div className="animate-rise relative mt-6 max-w-3xl space-y-3 text-lg text-parchment/85 sm:text-xl" style={{ animationDelay: "0.3s" }}>
        <p>Poverty. Disease. Climate change. The world&apos;s problems can feel so big that it seems nothing we do could matter.</p>
        <p className="font-display text-2xl uppercase tracking-wide text-brass sm:text-3xl">It is possible. We can make change.</p>
        <p className="text-base text-parchment/75">Lead any nation on Earth through twenty real years. Make the hard calls, face the setbacks, and see how many lives your choices can change.</p>
      </div>
      <div className="animate-rise relative mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "0.5s" }}>
        <Button onClick={onStart} className="px-8 py-3 text-base">Make your move</Button>
        <Button variant="outline" onClick={onHowItWorks}>How the game works</Button>
      </div>
      <WorldProgress />
      <div className="animate-rise relative mt-10 grid max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: "0.7s" }}>
        {[
          ["Any nation", "Every country in the World Bank's data, starting from its real conditions in a real year."],
          ["Real choices", "Options tailored to your country, from clinics to mega-dams. Some pay off big; some backfire; some are not what they seem."],
          ["Lives, counted", "See how many children survive and how many homes get power because of what you decided."],
          ["Your story vs history", "After every decision, read what happened in your timeline and what really happened, chapter by chapter."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-lg border border-line bg-panel/70 p-4 backdrop-blur-sm">
            <p className="font-display text-lg uppercase tracking-wide text-brass">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </div>
      <p className="relative mt-12 text-xs text-muted">{ATTRIBUTION}</p>
    </main>
  );
}

export interface SetupChoice {
  country: string;
  year: number;
  objective: Objective;
  difficulty: Difficulty;
  seed: string;
}

type SetupInfo = { checks: StartYearCheck[]; defaultStart: number | null } | { error: string };

export function Setup({ onConfirm, onBack, busy, error }: { onConfirm: (c: SetupChoice) => void; onBack: () => void; busy: boolean; error: string | null }) {
  const { countries, error: listError, retry } = useCountries();
  const [country, setCountry] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [info, setInfo] = useState<Record<string, SetupInfo>>({});
  const [year, setYear] = useState<number | null>(null);
  const [objective, setObjective] = useState<Objective>("balanced");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  // The world seed is chosen automatically. It keeps each game reproducible (the same seed and
  // decisions give the same dice and events) and lets "Replay" repeat a campaign exactly.
  // Setup only renders on the client (after the landing screen), so a random seed is safe here.
  const [seed] = useState(() => newSeed());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!country || (info[country] && !("error" in info[country]))) return;
    let cancelled = false;
    fetch(`/api/setup?country=${country}`)
      .then(async (r) => (r.ok ? r.json() : { error: (await r.json()).error ?? "Could not load data" }))
      .then((d: SetupInfo) => {
        if (cancelled) return;
        setInfo((prev) => ({ ...prev, [country]: d }));
        if (!("error" in d)) setYear(d.defaultStart);
      })
      .catch(() => !cancelled && setInfo((prev) => ({ ...prev, [country]: { error: "Historical data could not be loaded from the World Bank." } })));
    return () => { cancelled = true; };
  }, [country, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = countries?.find((c) => c.code === country) ?? null;
  const current = country ? info[country] : undefined;
  const checks = current && !("error" in current) ? current.checks : [];
  const playable = checks.some((c) => c.valid);
  const matches = useMemo(() => {
    if (!countries) return [];
    const q = query.trim().toLowerCase();
    return q ? countries.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q).slice(0, 8) : countries.filter((c) => FEATURED_COUNTRIES.includes(c.code));
  }, [countries, query]);

  const pick = (code: string) => {
    setCountry(code);
    const i = info[code];
    setYear(i && !("error" in i) ? i.defaultStart : null);
  };
  const fill = (code: string) => {
    if (code === country) return "#d4a84b";
    const i = info[code];
    if (i && !("error" in i)) return i.defaultStart ? "#2f6b5c" : "#4a2a2f";
    if (selected && countries?.find((c) => c.code === code)?.regionCode === selected.regionCode) return "#34465a";
    return "#27313f";
  };

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted hover:text-parchment">← Back</button>
        <p className="text-xs text-muted">{ATTRIBUTION}</p>
      </div>
      <h1 className="mt-3 font-display text-4xl uppercase tracking-wide">Choose your nation</h1>
      <p className="text-sm text-muted">{countries ? `${countries.length} countries from the World Bank country API.` : "Loading the World Bank country list…"} Click a territory or search. Coverage is checked live when you pick one.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-xl border border-line bg-panel/60 p-2">
          {listError ? (
            <div className="p-8 text-center"><p className="text-bad">{listError}</p><Button className="mt-3" variant="outline" onClick={retry}>Retry</Button></div>
          ) : (
            <WorldMap countries={countries ?? []} fill={fill} selected={country} onSelect={pick} height={470} />
          )}
          <div className="flex flex-wrap gap-4 px-3 pb-2 text-[11px] text-muted">
            <span><b className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#a9761f] align-middle" />Selected</span>
            <span><b className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#ecd28e] align-middle" />Hover</span>
            <span><b className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#2f6b5c] align-middle" />Playable (checked)</span>
            <span><b className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#4a2a2f] align-middle" />Not enough data</span>
            <span><b className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#34465a] align-middle" />Same region</span>
          </div>
        </div>

        <div className="space-y-4">
          <Panel eyebrow="Search" title="Find a nation">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a country name" aria-label="Search countries"
              className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-brass" />
            <p className="mt-2 text-[10px] uppercase tracking-wider text-muted">{query ? "Matches" : "Suggested"}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {matches.map((c) => (
                <button key={c.code} onClick={() => pick(c.code)} className={`rounded-full border px-3 py-1 text-xs ${country === c.code ? "border-brass bg-brass text-ink" : "border-line hover:border-brass/60"}`}>{c.name}</button>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="Dossier" title={selected?.name ?? "No nation selected"}>
            {!selected && <p className="text-sm text-muted">Pick a country on the map to scout its World Bank data.</p>}
            {selected && (
              <>
                <p className="text-sm text-muted">{selected.regionName} · {selected.incomeLevel}{selected.capital ? ` · Capital ${selected.capital}` : ""}</p>
                {!current && <p className="mt-3 animate-pulse text-sm text-brass">Scouting World Bank data coverage…</p>}
                {current && "error" in current && (
                  <div className="mt-3 space-y-2 text-sm"><p className="text-bad">{current.error} No substitute data is shown.</p><Button variant="outline" onClick={() => { setInfo((p) => { const n = { ...p }; delete n[selected.code]; return n; }); setAttempt((a) => a + 1); }}>Retry</Button></div>
                )}
                {checks.length > 0 && !playable && (
                  <p className="mt-3 text-sm text-bad">The World Bank does not have enough data for a 20-year game here (for example: {checks[0].missing.slice(0, 3).join(", ")}). Try another nation.</p>
                )}
                {playable && (
                  <>
                    <p className="mt-3 text-[10px] uppercase tracking-wider text-muted">Take office in</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {checks.map((c) => (
                        <button key={c.year} disabled={!c.valid} onClick={() => setYear(c.year)} title={c.valid ? `${c.year}–${c.year + 20}` : `Missing: ${c.missing.join(", ")}`}
                          className={`rounded border px-2 py-1 font-mono text-xs ${year === c.year ? "border-brass bg-brass text-ink" : c.valid ? "border-line hover:border-brass/60" : "cursor-not-allowed border-line/40 text-muted/40 line-through"}`}>{c.year}</button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel eyebrow="Draw your mission card" title="Mission">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(Object.keys(OBJECTIVES) as Objective[]).map((o) => (
              <button key={o} onClick={() => setObjective(o)} className={`relative overflow-hidden rounded-lg border p-4 text-left transition ${objective === o ? "border-brass bg-gradient-to-b from-brass/20 to-transparent" : "border-line hover:border-brass/50"}`}>
                <span className="absolute right-3 top-2 text-2xl text-brass/60">{OBJECTIVE_ICON[o]}</span>
                <p className="text-[9px] uppercase tracking-[0.25em] text-muted">Mission</p>
                <p className="font-display text-lg uppercase tracking-wide">{OBJECTIVES[o].title}</p>
                <p className="mt-1 text-xs text-muted">{OBJECTIVES[o].description}</p>
              </button>
            ))}
          </div>
        </Panel>
        <Panel eyebrow="Rules" title="Difficulty">
          <div className="grid grid-cols-3 gap-2">
            {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
              <button key={d} onClick={() => setDifficulty(d)} className={`rounded-md border px-3 py-2 text-sm capitalize ${difficulty === d ? "border-brass bg-brass/15 text-brass" : "border-line text-muted hover:text-parchment"}`}>{d}</button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Easy starts you with more money, political capital and public support, and collects more tax each turn. Hard gives you less of each.</p>
        </Panel>
      </div>

      {error && <p className="mt-4 rounded-md border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{error}</p>}
      <div className="mt-6 flex items-center justify-end gap-4">
        {selected && year && <p className="text-sm text-muted">{selected.name}, {year}–{year + 20} · {OBJECTIVES[objective].title}</p>}
        <Button disabled={!year || !playable || busy} onClick={() => country && year && onConfirm({ country, year, objective, difficulty, seed })} className="px-8 py-3 text-base">
          {busy ? "Loading World Bank data…" : "Take office"}
        </Button>
      </div>
    </main>
  );
}
