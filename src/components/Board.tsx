"use client";
import { useMemo } from "react";
import { formatValue } from "@/lib/format";
import type { Impact } from "@/lib/game/impact";
import type { GameState, Phase } from "@/lib/game/types";
import { CONSTANTS } from "@/lib/game/rules";
import type { CountryConfig } from "@/lib/worldbank/package";
import { developmentIndex, regionalStandings, type RivalsPackage, type Standing } from "@/lib/worldbank/rivals";
import { INDICATORS } from "@/lib/worldbank/indicators";
import { Panel } from "./ui";
import { WorldMap } from "./WorldMap";

const STEPS: { phase: Phase[]; label: string; detail: string }[] = [
  { phase: ["briefing"], label: "Intel", detail: "Read the world" },
  { phase: ["decision"], label: "Deploy", detail: "Commit a policy" },
  { phase: ["consequence"], label: "Resolve", detail: "Immediate effects" },
  { phase: ["reaction"], label: "Fortune", detail: "Dice and world events" },
];

export function StepTracker({ phase }: { phase: Phase }) {
  const active = STEPS.findIndex((s) => s.phase.includes(phase));
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Turn phases">
      {STEPS.map((s, i) => (
        <li key={s.label} className={`rounded-md border px-3 py-1.5 text-center transition ${i === active ? "border-brass bg-brass/15" : i < active ? "border-line bg-white/[0.03] text-muted" : "border-line/60 text-muted/60"}`} aria-current={i === active ? "step" : undefined}>
          <p className={`font-display text-sm uppercase tracking-wider ${i === active ? "text-brass" : ""}`}>{i + 1}. {s.label}</p>
          <p className="hidden text-[10px] text-muted sm:block">{s.detail}</p>
        </li>
      ))}
    </ol>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[25, 25], [50, 50], [75, 75]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

export function Die({ value, delay = 0 }: { value: number; delay?: number }) {
  return (
    <svg viewBox="0 0 100 100" className="h-14 w-14 animate-[roll_0.7s_ease-out_both] drop-shadow-lg" style={{ animationDelay: `${delay}s` }} role="img" aria-label={`Die showing ${value}`}>
      <rect x="4" y="4" width="92" height="92" rx="18" fill="#e8e4d8" stroke="#d4a84b" strokeWidth="4" />
      {PIPS[value].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" fill="#0b0f14" />)}
    </svg>
  );
}

export function FortuneRoll({ dice }: { dice: [number, number] }) {
  const total = dice[0] + dice[1];
  const [lo, hi] = CONSTANTS.diceSeverityRange;
  const factor = lo + ((total - 2) / 10) * (hi - lo);
  return (
    <div className="flex items-center gap-4 rounded-lg border border-brass/30 bg-brass/5 p-3">
      <div className="flex gap-2"><Die value={dice[0]} /><Die value={dice[1]} delay={0.1} /></div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brass">Fortune roll · {total}</p>
        <p className="text-sm text-parchment/85">{total >= 9 ? "The dice ran hot: this event hits harder than usual" : total <= 5 ? "The dice ran cold: this event lands softly" : "An ordinary roll"} ({factor.toFixed(2)}× strength).</p>
      </div>
    </div>
  );
}

/** Player's simulated development index for the current turn. */
export function playerIndex(state: GameState): number | null {
  return developmentIndex(state.metrics);
}

export function standingsFor(state: GameState, rivals: RivalsPackage | null): Standing[] {
  if (!rivals) return [];
  const turnIndex = state.metricHistory.length - 1;
  return regionalStandings({ code: state.countryCode, name: state.countryName, index: playerIndex(state) }, rivals, turnIndex);
}

export function isRegionLeader(standings: Standing[]): boolean {
  const rivals = standings.filter((s) => !s.isPlayer);
  return rivals.length > 0 && rivals.filter((s) => s.influenced).length / rivals.length >= CONSTANTS.regionLeaderShare;
}

export function RegionBoard({ state, rivals, rivalsError, countries }: { state: GameState; rivals: RivalsPackage | null; rivalsError: string | null; countries: CountryConfig[] }) {
  const standings = useMemo(() => standingsFor(state, rivals), [state, rivals]);
  const byCode = new Map(standings.map((s) => [s.code, s]));
  const onBoard = standings.filter((s) => !s.isPlayer);
  const influenced = onBoard.filter((s) => s.influenced).length;
  const leader = isRegionLeader(standings);
  const rank = standings.findIndex((s) => s.isPlayer) + 1;
  const regionCountries = countries.filter((c) => c.regionCode === state.setup.country.regionCode);
  const fill = (code: string) => {
    if (code === state.countryCode) return "#d4a84b";
    const s = byCode.get(code);
    if (!s) return "#1f2833";
    return s.influenced ? "#3f8fb8" : "#5b4652";
  };
  return (
    <Panel eyebrow={`The board · ${rivals?.regionName ?? state.setup.country.regionName}`} title="Regional influence"
      right={rivals && <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wider ${leader ? "border-good/50 text-good" : "border-line text-muted"}`}>{leader ? `Region leader · +${CONSTANTS.regionLeaderBonus} capital/turn` : `Lead ${Math.ceil(onBoard.length * CONSTANTS.regionLeaderShare)} rivals for a bonus`}</span>}>
      {rivalsError && <p className="text-sm text-bad">{rivalsError}</p>}
      {!rivals && !rivalsError && <p className="animate-pulse text-sm text-muted">Loading rival nations from the World Bank…</p>}
      {rivals && (
        <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
          <div>
            <WorldMap countries={regionCountries} fill={fill} selected={state.countryCode} focus={regionCountries.map((c) => c.code)} height={300}
              labelFor={(code) => { const s = byCode.get(code); return s ? `Development index ${s.index.toFixed(0)}${s.isPlayer ? " (you, simulated)" : " (World Bank data)"}` : "Not enough data"; }} />
            <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted">
              <span><b className="mr-1 inline-block h-2 w-2 rounded-sm bg-brass" />You</span>
              <span><b className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#3f8fb8]" />You out-develop them ({influenced})</span>
              <span><b className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#5b4652]" />Ahead of you ({onBoard.length - influenced})</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Rank {rank} of {standings.length} in {state.currentYear}</p>
            <ol className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1 text-sm">
              {standings.map((s, i) => (
                <li key={s.code} className={`flex items-center justify-between rounded px-2 py-1 ${s.isPlayer ? "bg-brass/15 text-brass" : ""}`}>
                  <span className="truncate"><span className="mr-2 font-mono text-[10px] text-muted">{i + 1}</span>{s.name}</span>
                  <span className={`font-mono text-xs ${s.isPlayer ? "" : s.influenced ? "text-sim" : "text-muted"}`}>{s.index.toFixed(1)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">Development index 0–100 from life expectancy, GDP per capita, infant mortality and electricity. Rivals use real World Bank data for {state.currentYear}; your value is simulated. A game index, not the UN HDI.</p>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function SdgChips({ sdgs, harms }: { sdgs?: number[]; harms?: number[] }) {
  if (!sdgs?.length && !harms?.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {sdgs?.map((g) => <span key={g} title={`Advances UN Sustainable Development Goal ${g}`} className="rounded bg-good/15 px-1.5 py-0.5 text-[9px] font-semibold text-good">SDG {g}</span>)}
      {harms?.map((g) => <span key={`h${g}`} title={`Undermines UN Sustainable Development Goal ${g}`} className="rounded bg-bad/15 px-1.5 py-0.5 text-[9px] font-semibold text-bad">Undermines SDG {g}</span>)}
    </span>
  );
}

function fmtCount(n: number): string {
  const a = Math.abs(n);
  const s = a >= 1e6 ? (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "K" : Math.round(a).toString();
  return (n < 0 ? "−" : "") + s;
}

export function ImpactLedger({ impact, label }: { impact: Impact | null; label: string }) {
  if (!impact) return null;
  const items = [
    { title: "Infant lives saved", value: impact.infantLivesSaved, good: (v: number) => v > 0, note: "babies who survived their first year" },
    { title: "People with electricity", value: impact.peopleWithPower, good: (v: number) => v > 0, note: "more people with power" },
    { title: "Extra CO2 emitted", value: impact.extraCo2Tonnes, good: (v: number) => v < 0, note: "tonnes over the period" },
  ];
  return (
    <Panel eyebrow="AI for Social Good · impact ledger" title="Lives behind the numbers">
      <p className="-mt-2 mb-3 text-xs text-muted">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((i) => (
          <div key={i.title} className="rounded-md border border-line bg-panel-2/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted">{i.title}</p>
            <p className={`font-display text-2xl ${i.value === null ? "text-muted" : i.good(i.value) ? "text-good" : Math.abs(i.value) < 1 ? "text-parchment" : "text-bad"}`}>{i.value === null ? "–" : fmtCount(i.value)}</p>
            <p className="text-[10px] text-muted">{i.note}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted">Simulated estimates from infant mortality × births, electricity access × population, and emissions per person × population. {INDICATORS.birthRate.code} sets births.</p>
    </Panel>
  );
}

export { formatValue };
