"use client";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatValue, signed } from "@/lib/format";
import { OBJECTIVES, POLICIES } from "@/lib/game/rules";
import { historyDelta, type Values } from "@/lib/game/scoring";
import type { GameState } from "@/lib/game/types";
import { CATEGORY_LABELS, INDICATORS, SCORE_CATEGORIES, type IndicatorId } from "@/lib/worldbank/indicators";
import type { RevealPackage } from "@/lib/worldbank/package";
import { compareImpact, pathFromMetrics } from "@/lib/game/impact";
import type { RealHistory } from "@/lib/game/story";
import type { RivalsPackage } from "@/lib/worldbank/rivals";
import { ImpactLedger, standingsFor } from "./Board";
import { Chronicle } from "./Story";
import { ATTRIBUTION, Button, Panel } from "./ui";

const COMPARE: IndicatorId[] = ["gdpPerCapita", "lifeExpectancy", "infantMortality", "electricity", "education", "unemployment", "co2", "renewable"];

function describe(id: IndicatorId, player: number, real: number, better: boolean): string {
  const def = INDICATORS[id];
  const name = def.shortName.toLowerCase();
  return better
    ? `Your strategy left ${name} at ${formatValue(id, player)}, versus ${formatValue(id, real)} in the real ${def.higherIsBetter ? "historical outcome" : "record"}. That is the category where your timeline outperformed history most.`
    : `Your timeline ended with ${name} at ${formatValue(id, player)}, compared with ${formatValue(id, real)} historically. This is where your choices cost the most relative to history.`;
}

export function Reveal({ state, rivals, realSoFar, onRestart, onReplay }: { state: GameState; rivals: RivalsPackage | null; realSoFar: RealHistory | null; onRestart: () => void; onReplay: () => void }) {
  const [data, setData] = useState<RevealPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reveal?country=${state.countryCode}&year=${state.startYear}&edu=${encodeURIComponent(state.setup.educationCode)}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error))))
      .then((d: RevealPackage) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError(String(e.message ?? e)));
    return () => { cancelled = true; };
  }, [state, attempt]);

  const analysis = useMemo(() => {
    if (!data) return null;
    const last = data.turnYears.length - 1;
    const start: Values = Object.fromEntries(Object.entries(state.realStart).map(([k, v]) => [k, v?.value]));
    const player: Values = state.metrics;
    const real: Values = Object.fromEntries(Object.entries(data.history).map(([k, series]) => [k, series[last]?.value ?? null]));
    const years = data.turnYears;
    const cbr = state.realStart.birthRate?.value ?? null;
    const historyPath = {
      years,
      infantMortality: data.history.infantMortality.map((v) => v?.value ?? null),
      electricity: data.history.electricity.map((v) => v?.value ?? null),
      co2: data.history.co2.map((v) => v?.value ?? null),
      population: data.history.population.map((v) => v?.value ?? null),
      birthRate: data.history.birthRate.map((v) => v?.value ?? null),
    };
    const impact = compareImpact(pathFromMetrics(years, state.metricHistory, cbr), historyPath);
    return { start, player, real, delta: historyDelta(start, player, real, state.objective), last, impact };
  }, [data, state]);
  const finalStandings = useMemo(() => standingsFor(state, rivals), [state, rivals]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl flex-1 px-6 py-24 text-center">
        <h1 className="font-display text-4xl uppercase">History could not be loaded</h1>
        <p className="mt-3 text-muted">The World Bank data for the reveal did not arrive. Your timeline is saved in this session. No substitute history is shown.</p>
        <Button className="mt-6" onClick={() => setAttempt((a) => a + 1)}>Retry</Button>
      </main>
    );
  }
  if (!data || !analysis) {
    return <main className="flex flex-1 items-center justify-center"><p className="animate-pulse font-display text-2xl uppercase tracking-[0.3em] text-brass">Opening the archives…</p></main>;
  }
  const { delta, real, player, start, last, impact } = analysis;
  const rank = finalStandings.findIndex((s) => s.isPlayer) + 1;
  const beat = delta.playerTotal !== null && delta.historicalTotal !== null && delta.playerTotal > delta.historicalTotal;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6">
      <p className="animate-rise text-center text-xs font-semibold uppercase tracking-[0.35em] text-brass">{state.countryName} · {state.startYear}–{state.currentYear}</p>
      <h1 className="animate-sweep mt-3 text-center font-display text-5xl font-bold uppercase sm:text-7xl">{beat ? "You beat history" : "History wins this time"}</h1>
      <div className="animate-rise mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-4" style={{ animationDelay: "0.3s" }}>
        <div className="rounded-xl border border-sim/50 bg-sim/10 p-5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-sim">Your timeline · simulated</p>
          <p className="mt-1 font-display text-6xl">{delta.playerTotal === null ? "–" : Math.round(delta.playerTotal)}</p>
        </div>
        <div className="rounded-xl border border-hist/50 bg-hist/10 p-5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-hist">Real history · World Bank data</p>
          <p className="mt-1 font-display text-6xl">{delta.historicalTotal === null ? "–" : Math.round(delta.historicalTotal)}</p>
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-muted">{OBJECTIVES[state.objective].title} score, 0 to 100, where 50 means no change from {state.startYear}. Same formula for both.</p>
      {state.personalWealth > 0 && (
        <p className="mx-auto mt-4 max-w-3xl rounded-lg border border-hist/40 bg-hist/10 p-3 text-center text-sm text-hist">
          You left office with about ${Math.round(state.personalWealth)} million in hidden accounts, taken through {state.decisionHistory.filter((d) => POLICIES[d.policyId]?.enrichment).length} corrupt decisions. The impact ledger below shows who paid for it.
        </p>
      )}
      {rank > 0 && <p className="mt-2 text-center text-sm text-brass">Final regional rank: {rank} of {finalStandings.length} in {rivals?.regionName} ({finalStandings.filter((s) => s.influenced).length} rivals out-developed in {state.currentYear}).</p>}
      <div className="mx-auto mt-8 max-w-4xl"><ImpactLedger impact={impact} label={`Your simulated timeline versus what really happened in ${state.countryName}, ${state.startYear}–${state.currentYear}. Positive lives saved means fewer infant deaths than history recorded.`} /></div>

      <Panel eyebrow="The difference" title="History Delta" className="mt-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            {SCORE_CATEGORIES.map((c) => {
              const d = delta.delta[c];
              const width = d === null ? 0 : Math.min(50, Math.abs(d));
              return (
                <div key={c} className="grid grid-cols-[110px_1fr_56px] items-center gap-3">
                  <span className="text-sm text-parchment/85">{CATEGORY_LABELS[c]}</span>
                  <div className="relative h-3 rounded bg-white/5">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                    {d !== null && <div className={`absolute inset-y-0 rounded ${d >= 0 ? "left-1/2 bg-good" : "right-1/2 bg-bad"}`} style={{ width: `${width}%` }} />}
                  </div>
                  <span className={`text-right font-mono text-sm ${d === null ? "text-muted" : d >= 0 ? "text-good" : "text-bad"}`}>{d === null ? "n/a" : signed(d)}</span>
                </div>
              );
            })}
            <p className="text-xs text-muted">Your category score minus history&apos;s, computed only from indicators with a real {state.currentYear} observation.</p>
          </div>
          <div className="grid gap-3">
            {delta.biggestSuccess && (
              <div className="rounded-lg border border-good/40 bg-good/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-good">Biggest success · {INDICATORS[delta.biggestSuccess.id].shortName}</p>
                <p className="mt-1 text-sm">{describe(delta.biggestSuccess.id, player[delta.biggestSuccess.id]!, real[delta.biggestSuccess.id]!, true)}</p>
              </div>
            )}
            {delta.biggestTradeoff && (
              <div className="rounded-lg border border-bad/40 bg-bad/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bad">Biggest tradeoff · {INDICATORS[delta.biggestTradeoff.id].shortName}</p>
                <p className="mt-1 text-sm">{describe(delta.biggestTradeoff.id, player[delta.biggestTradeoff.id]!, real[delta.biggestTradeoff.id]!, false)}</p>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COMPARE.filter((id) => start[id] != null).map((id) => {
          const r = data.history[id][last];
          const p = player[id];
          const def = INDICATORS[id];
          const better = r && p !== undefined && p !== null && def.higherIsBetter !== null ? (p > r.value) === def.higherIsBetter : null;
          return (
            <div key={id} className="rounded-xl border border-line bg-panel/80 p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted">{def.shortName}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div><p className="text-[9px] font-semibold uppercase tracking-wider text-sim">Your timeline</p><p className={`font-display text-2xl ${better === null ? "" : better ? "text-good" : "text-parchment"}`}>{formatValue(id, p)}</p></div>
                <div><p className="text-[9px] font-semibold uppercase tracking-wider text-hist">Historical</p><p className="font-display text-2xl">{r ? formatValue(id, r.value) : "No data"}</p></div>
              </div>
              {r && <p className="mt-1 font-mono text-[10px] text-muted">{r.code} · observed {r.observationYear}{r.isEstimated ? " (nearest year)" : ""}</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {COMPARE.filter((id) => start[id] != null).slice(0, 6).map((id) => {
          const rows = data.turnYears.map((year, i) => ({
            year,
            simulated: state.metricHistory[i]?.metrics[id] ?? null,
            historical: data.history[id][i]?.value ?? null,
          }));
          return (
            <Panel key={id} eyebrow={INDICATORS[id].unit} title={INDICATORS[id].shortName}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={{ top: 5, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#263140" vertical={false} />
                    <XAxis dataKey="year" stroke="#8d97a5" fontSize={11} tickLine={false} />
                    <YAxis stroke="#8d97a5" fontSize={11} tickLine={false} width={56} tickFormatter={(v: number) => formatValue(id, v)} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ background: "#121821", border: "1px solid #263140", borderRadius: 8, fontSize: 12 }} formatter={(v) => formatValue(id, Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine x={state.startYear} stroke="#d4a84b" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="simulated" name="Simulated (your timeline)" stroke="#5fb3d9" strokeWidth={2} dot={{ r: 3 }} connectNulls animationDuration={500} />
                    <Line type="monotone" dataKey="historical" name="World Bank historical data" stroke="#e0a45c" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel eyebrow="Twenty years in ten chapters" title="Your chronicle" className="mt-6">
        <Chronicle state={state} real={data ? data.history : realSoFar} />
      </Panel>

      <Panel eyebrow="Your reign" title="Decisions and events" className="mt-6">
        <ol className="grid gap-2 md:grid-cols-2">
          {state.decisionHistory.map((d) => (
            <li key={d.turn} className="flex gap-3 rounded-md bg-panel-2/60 p-3 text-sm">
              <span className="font-display text-brass">{d.year}</span>
              <span><span className="text-parchment">{d.policyTitle}</span><span className="text-muted"> · world: {state.eventHistory.find((e) => e.turn === d.turn)?.title}</span></span>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={onReplay}>Replay {state.countryName} with the same seed</Button>
        <Button variant="outline" onClick={onRestart}>New campaign</Button>
      </div>
      <p className="mt-8 text-center text-xs text-muted">{ATTRIBUTION} Simulated values are produced by the game&apos;s model and are not World Bank observations. The World Bank does not endorse these simulated outcomes. Seed: <span className="font-mono">{state.seed}</span></p>
    </main>
  );
}
