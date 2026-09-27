"use client";
import { signed } from "@/lib/format";
import { OBJECTIVES, POLICIES } from "@/lib/game/rules";
import { categoryScores, type Values } from "@/lib/game/scoring";
import { briefing, canAfford, currentProblem, rankedOptions } from "@/lib/game/simulation";
import type { GameState, MechanicsDelta } from "@/lib/game/types";
import { CATEGORY_LABELS, INDICATORS, SCORE_CATEGORIES, type IndicatorId } from "@/lib/worldbank/indicators";
import { chapterFor, type RealHistory } from "@/lib/game/story";
import type { Impact } from "@/lib/game/impact";
import type { CountryConfig } from "@/lib/worldbank/package";
import type { RivalsPackage } from "@/lib/worldbank/rivals";
import { FortuneRoll, ImpactLedger, RegionBoard, SdgChips, StepTracker } from "./Board";
import { ChapterView, Chronicle } from "./Story";
import { ATTRIBUTION, Button, Meter, Panel, StatCard } from "./ui";

const HEADLINE: IndicatorId[] = ["population", "gdpPerCapita", "gdpGrowth", "lifeExpectancy", "infantMortality", "electricity", "education", "unemployment", "urban", "co2"];

export function CountryBriefing({ state, onBegin }: { state: GameState; onBegin: () => void }) {
  const ids: IndicatorId[] = ["population", "gdpPerCapita", "gdpGrowth", "lifeExpectancy", "infantMortality", "urban", "electricity", "education", "unemployment", "fdi", "trade", "co2", "renewable", "internet"];
  const estimated = ids.filter((id) => state.realStart[id]?.isEstimated);
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <p className="animate-rise text-xs font-semibold uppercase tracking-[0.3em] text-brass">National briefing · Classified</p>
      <h1 className="animate-sweep mt-3 font-display text-6xl font-bold uppercase sm:text-7xl">{state.countryName}</h1>
      <p className="animate-rise font-display text-4xl text-brass">{state.startYear}</p>
      <p className="animate-rise mt-4 max-w-2xl text-parchment/80">You have taken office. These are the real conditions your country faced in {state.startYear}, as recorded by the World Bank. Click any statistic to see its indicator code and observation year.</p>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ids.filter((id) => state.realStart[id]).map((id, i) => (
          <div key={id} className="animate-rise" style={{ animationDelay: `${0.05 * i}s` }}>
            <StatCard id={id} value={state.realStart[id]!.value} real={state.realStart[id]} />
          </div>
        ))}
      </div>
      {estimated.length > 0 && <p className="mt-4 text-xs text-hist">Nearest-year values: {estimated.map((id) => `${INDICATORS[id].shortName} (${state.realStart[id]!.observationYear})`).join(", ")}. No World Bank observation exists for {state.startYear}.</p>}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brass/30 bg-brass/5 p-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-brass">Your mission</p>
          <p className="font-display text-2xl uppercase">{OBJECTIVES[state.objective].title}</p>
          <p className="text-sm text-muted">{OBJECTIVES[state.objective].description} Twenty years. Ten decisions. Then history is revealed.</p>
          <p className="mt-2 text-sm text-good">The problems ahead are real, and they are big. But every number on this page is made of choices, and choices can change it.</p>
        </div>
        <Button onClick={onBegin} className="px-8 py-3 text-base">Begin turn 1</Button>
      </div>
      <p className="mt-6 text-xs text-muted">{ATTRIBUTION}</p>
    </main>
  );
}

function MechDelta({ delta }: { delta: MechanicsDelta }) {
  const items = [["Treasury", delta.treasury], ["Political capital", delta.politicalCapital], ["Public satisfaction", delta.satisfaction]] as const;
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(([label, v]) => (
        <div key={label} className="rounded-md border border-mech/30 bg-mech/5 p-2 text-center">
          <p className="text-[10px] uppercase tracking-wider text-mech/80">{label}</p>
          <p className={`font-display text-xl ${!v ? "text-muted" : v > 0 ? "text-good" : "text-bad"}`}>{v ? signed(v) : "0"}</p>
        </div>
      ))}
    </div>
  );
}

/** Harmful options wear the label of a respectable ministry, so nothing gives them away. */
function officialCategory(category: string): string {
  return category === "Corruption" ? "Infrastructure" : category === "Repression" ? "Governance" : category;
}

/** After enacting: what a harmful policy really did. Shown only once the choice is made. */
function FinePrint({ state }: { state: GameState }) {
  const last = state.decisionHistory[state.decisionHistory.length - 1];
  const policy = last ? POLICIES[last.policyId] : undefined;
  if (!policy?.harmful) return null;
  return (
    <div className="mt-4 rounded-md border border-bad/50 bg-bad/10 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bad">The fine print</p>
      <p className="mt-1 text-sm text-parchment/90">{policy.truth || "This policy served you and your allies more than your people."}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SdgChips harms={policy.harms} />
        {policy.enrichment ? <span className="rounded bg-hist/20 px-1.5 py-0.5 text-[10px] font-semibold text-hist">About ${Math.round(policy.enrichment)} million reached your private accounts</span> : null}
      </div>
    </div>
  );
}

function hintColor(h: string) {
  return h.startsWith("+") ? "text-good" : "text-bad";
}

export function Dashboard({ state, onBeginDecision, onDecide, onReact, onNext, onHowItWorks, rivals, rivalsError, countries, impact, real, realPending, realError, onRetryReal }: {
  state: GameState;
  rivals: RivalsPackage | null;
  rivalsError: string | null;
  countries: CountryConfig[];
  impact: Impact | null;
  real: RealHistory | null;
  realPending: boolean;
  realError: string | null;
  onRetryReal: () => void;
  onBeginDecision: () => void;
  onDecide: (policyId: string) => void;
  onReact: () => void;
  onNext: () => void;
  onHowItWorks: () => void;
}) {
  const startValues: Values = Object.fromEntries(Object.entries(state.realStart).map(([k, v]) => [k, v?.value]));
  const scores = categoryScores(startValues, state.metrics);
  const prev = state.metricHistory.length > 1 ? state.metricHistory[state.metricHistory.length - 2].metrics : undefined;
  const problem = currentProblem(state);
  const isStart = state.metricHistory.length === 1;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel/80 px-5 py-3">
        <div className="flex items-baseline gap-4">
          <h1 className="font-display text-3xl uppercase tracking-wide">{state.countryName}</h1>
          <span key={state.currentYear} className="animate-rise font-display text-3xl text-brass">{state.currentYear}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-muted">Turn <span className="font-mono text-parchment">{state.turn}</span> / {state.totalTurns}</span>
          <span className="rounded-full border border-brass/40 px-3 py-1 text-xs uppercase tracking-wider text-brass">{OBJECTIVES[state.objective].title}</span>
          <button onClick={onHowItWorks} className="text-xs uppercase tracking-wider text-muted hover:text-parchment">How it works</button>
          <a href="/data" target="_blank" className="text-xs uppercase tracking-wider text-muted hover:text-parchment">Data source ↗</a>
        </div>
      </header>

      <div className="mt-3 grid gap-3 rounded-xl border border-mech/30 bg-mech/[0.04] px-5 py-3 sm:grid-cols-[auto_1fr_1fr_1fr_auto] sm:items-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mech">Game mechanics<br /><span className="font-normal normal-case tracking-normal text-muted">not World Bank data</span></p>
        <Meter label="Treasury" value={state.treasury} color="#d4a84b" hint="Money available for policies. Refills with tax revenue each turn." />
        <Meter label="Political capital" value={state.politicalCapital} color="#b58cf0" hint="Needed for major reforms. Regenerates slowly, faster when the public is satisfied." />
        <Meter label="Public satisfaction" value={state.satisfaction} color={state.satisfaction < 35 ? "#e36d5e" : "#6cc58a"} hint="Below 35 slows growth and political capital." />
        <div className="min-w-[120px] text-right" title="Money you have secretly pocketed through corrupt choices. The more you take, the likelier a scandal.">
          <p className="text-[11px] uppercase tracking-wider text-muted">Hidden fortune</p>
          <p className={`font-display text-xl ${state.personalWealth > 0 ? "text-hist" : "text-muted"}`}>{state.personalWealth > 0 ? `$${Math.round(state.personalWealth)}M` : "None"}</p>
        </div>
      </div>

      <div className="mt-3"><StepTracker phase={state.phase} /></div>

      <div className="mt-3 grid grid-cols-5 gap-2">
        {SCORE_CATEGORIES.map((c) => (
          <div key={c} className="rounded-lg border border-line bg-panel/70 px-3 py-2">
            <p className="truncate text-[10px] uppercase tracking-wider text-muted">{CATEGORY_LABELS[c]}</p>
            <p className="font-display text-2xl">{scores[c] === null ? "–" : Math.round(scores[c]!)}</p>
            <div className="mt-1 h-1 rounded bg-white/5"><div className="h-1 rounded bg-sim transition-all duration-700" style={{ width: `${scores[c] ?? 0}%` }} /></div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_320px]">
        <div key={`${state.turn}-${state.phase}`} className="animate-rise">
          {state.phase === "briefing" && <BriefingPhase state={state} onContinue={onBeginDecision} />}
          {state.phase === "decision" && (
            <Panel eyebrow={`National problem · ${state.currentYear}`} title={problem.title}>
              <p className="max-w-3xl text-parchment/85">{problem.describe(state)}</p>
              <p className="mt-1 text-sm text-muted">Your ministries propose the options that fit {state.countryName} best. Exact results are unknown until you commit.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {rankedOptions(state).map(({ policy: p, reason }) => {
                  const affordable = canAfford(state, p);
                  return (
                    <button key={p.id} data-policy={p.id} data-harmful={p.harmful ? "true" : undefined} disabled={!affordable} onClick={() => onDecide(p.id)} className="group flex flex-col rounded-lg border border-line bg-panel-2/80 p-4 text-left transition hover:border-brass disabled:cursor-not-allowed disabled:opacity-40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-brass/80">{p.harmful ? officialCategory(p.category) : p.category}</span>
                        <span className="font-mono text-[11px] text-muted">{p.cost.treasury ? `−${p.cost.treasury} treasury` : "no cost"} · −{p.cost.politicalCapital} capital</span>
                      </div>
                      <p className="mt-1 font-display text-xl uppercase tracking-wide group-hover:text-brass">{p.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2"><SdgChips sdgs={p.sdgs} /></div>
                      {reason && <p className="mt-1 text-[11px] text-brass/90">Why here: {reason}</p>}
                      <p className="mt-1 text-sm text-muted">{p.description}</p>
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-xs">
                        {Object.entries(p.hints).map(([k, h]) => (
                          <div key={k} className="flex justify-between"><span className="text-parchment/70">{k}</span><span className={hintColor(h)}>{h}</span></div>
                        ))}
                      </div>
                      {p.risk && <p className="mt-2 text-[11px] text-hist">Risk: {Math.round(p.risk.chance * 100)}% chance of setbacks</p>}
                      {!affordable && <p className="mt-2 text-[11px] text-bad">Not enough political capital or treasury.</p>}
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}
          {state.phase === "consequence" && state.lastOutcome && (
            <Panel eyebrow="Decision enacted" title={`${state.lastOutcome.policyTitle} approved`}>
              <MechDelta delta={state.lastOutcome.mechanics} />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Immediate effects</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {state.lastOutcome.immediate.map((e) => <li key={e.label} className="flex justify-between"><span>{e.label}</span><span className={e.direction === "up" ? "text-good" : "text-bad"}>{e.direction === "up" ? "increases" : "decreases"}</span></li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Delayed effects scheduled</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {state.lastOutcome.scheduled.length ? state.lastOutcome.scheduled.map((e) => <li key={e.label}>{e.label} <span className="text-muted">from {e.startsYear}</span></li>) : <li className="text-muted">None</li>}
                  </ul>
                </div>
              </div>
              {state.lastOutcome.riskMessage && <p className="mt-4 rounded-md border border-hist/40 bg-hist/10 p-3 text-sm text-hist">Setback: {state.lastOutcome.riskMessage}</p>}
              <FinePrint state={state} />
              <div className="mt-5 flex justify-end"><Button onClick={onReact}>See how the world reacts</Button></div>
            </Panel>
          )}
          {state.phase === "reaction" && state.lastReaction && (() => {
            const chapter = chapterFor(state, state.turn, real);
            return (
              <Panel eyebrow={`Chapter ${state.turn} of ${state.totalTurns} · ${state.currentYear - 2}–${state.currentYear}`} title={state.lastReaction.title}>
                <FortuneRoll dice={state.lastReaction.dice} eventId={state.lastReaction.eventId} />
                {state.lastReaction.regionBonus > 0 && <p className="mt-2 rounded-md border border-good/40 bg-good/10 p-3 text-sm text-good">Regional leadership: you out-develop most of your region. +{state.lastReaction.regionBonus} political capital.</p>}
                {state.lastReaction.callbacks.map((c) => <p key={c} className="mt-2 rounded-md border border-sim/30 bg-sim/10 p-3 text-sm text-sim">{c}</p>)}
                {state.lastReaction.crisis && <p className="mt-2 rounded-md border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{state.lastReaction.crisis}</p>}
                {chapter && <div className="mt-4"><ChapterView chapter={chapter} realPending={realPending} realError={realError} onRetryReal={onRetryReal} /></div>}
                <div className="mt-5 flex justify-end"><Button onClick={onNext}>{state.turn >= state.totalTurns ? "Reveal history" : `Advance to ${state.currentYear}`}</Button></div>
              </Panel>
            );
          })()}
        </div>

        <Panel eyebrow={isStart ? "World Bank data" : "Your timeline"} title="Country indicators" className="self-start">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {HEADLINE.filter((id) => state.metrics[id] !== undefined).map((id) => (
              <StatCard key={id} id={id} value={state.metrics[id]} real={isStart ? state.realStart[id] : undefined} simulated={!isStart} previous={prev?.[id]} />
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.6fr_1fr]">
        <RegionBoard state={state} rivals={rivals} rivalsError={rivalsError} countries={countries} />
        <ImpactLedger impact={impact} label={isStart ? "Make your first decisions to see their human impact." : `Your policies versus staying the course every turn, same country, seed and world, ${state.startYear}–${state.currentYear}.`} />
      </div>

      <Panel eyebrow="The story so far" title="Your chronicle" className="mt-3">
        <Chronicle state={state} real={real} />
      </Panel>
      <p className="mt-4 text-center text-xs text-muted">{ATTRIBUTION} Simulated values are generated by the game&apos;s model.</p>
    </main>
  );
}

function BriefingPhase({ state, onContinue }: { state: GameState; onContinue: () => void }) {
  const b = briefing(state);
  const effects = state.activeEffects.filter((e) => e.startsTurn <= state.turn && e.endsTurn >= state.turn);
  return (
    <Panel eyebrow={`Turn ${state.turn} briefing`} title={`The world in ${state.currentYear}`}>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-hist">Global conditions · World Bank aggregates</p>
          <ul className="mt-2 space-y-1.5 text-sm">{b.global.map((g) => <li key={g} className="border-l-2 border-hist/40 pl-3">{g}</li>)}</ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sim">Domestic conditions{state.turn > 1 ? " · simulated" : ""}</p>
          <ul className="mt-2 space-y-1.5 text-sm">{b.domestic.map((g) => <li key={g} className="border-l-2 border-sim/40 pl-3">{g}</li>)}</ul>
        </div>
      </div>
      {effects.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Policies still at work</p>
          <ul className="mt-2 flex flex-wrap gap-2">{effects.map((e) => <li key={e.id} className="rounded-full border border-line px-3 py-1 text-xs text-parchment/80">{e.label}</li>)}</ul>
        </div>
      )}
      <div className="mt-6 flex justify-end"><Button onClick={onContinue}>Face this turn&apos;s problem</Button></div>
    </Panel>
  );
}
