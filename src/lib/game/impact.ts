// Impact ledger: turns indicator differences into human terms. All results are simulated estimates.
//
// Infant lives saved over a period = sum over each 2-year step of
//   births per year x 2 x (comparison infant mortality - player infant mortality) / 1,000,
// using the average of the step's start and end rates.
// Births per year = population x crude birth rate / 1,000.
// People with electricity gained = (player access - comparison access) / 100 x population at the end.
// Extra CO2 = (player - comparison) tonnes per person x population, summed per year over the period.
import { FALLBACK_POLICY } from "./rules";
import { applyDecision, beginDecision, createGame, nextTurn, worldReaction } from "./simulation";
import type { GameState, SimulatedMetrics } from "./types";

export interface Path {
  years: number[];
  infantMortality: (number | null)[];
  electricity: (number | null)[];
  co2: (number | null)[];
  population: (number | null)[];
  birthRate: (number | null)[];
}

export interface Impact {
  infantLivesSaved: number | null;
  peopleWithPower: number | null;
  extraCo2Tonnes: number | null;
}

export function pathFromMetrics(years: number[], history: { metrics: SimulatedMetrics }[], birthRateAtStart: number | null): Path {
  const pop0 = history[0]?.metrics.popGrowth;
  return {
    years,
    infantMortality: history.map((h) => h.metrics.infantMortality ?? null),
    electricity: history.map((h) => h.metrics.electricity ?? null),
    co2: history.map((h) => h.metrics.co2 ?? null),
    population: history.map((h) => h.metrics.population ?? null),
    // Births fall as population growth slows: scale the real starting birth rate by relative population growth.
    birthRate: history.map((h) =>
      birthRateAtStart === null ? null : pop0 && h.metrics.popGrowth !== undefined && pop0 > 0 ? birthRateAtStart * Math.max(0.4, Math.min(1.2, h.metrics.popGrowth / pop0)) : birthRateAtStart,
    ),
  };
}

export function compareImpact(player: Path, comparison: Path): Impact {
  let lives = 0, livesOk = true, co2 = 0, co2Ok = true;
  for (let i = 0; i + 1 < player.years.length; i++) {
    const span = player.years[i + 1] - player.years[i];
    const pImr = avg(player.infantMortality[i], player.infantMortality[i + 1]);
    const cImr = avg(comparison.infantMortality[i], comparison.infantMortality[i + 1]);
    const pop = avg(comparison.population[i], comparison.population[i + 1]) ?? avg(player.population[i], player.population[i + 1]);
    const cbr = avg(comparison.birthRate[i], comparison.birthRate[i + 1]) ?? avg(player.birthRate[i], player.birthRate[i + 1]);
    if (pImr === null || cImr === null || pop === null || cbr === null) livesOk = false;
    else lives += ((pop * cbr) / 1000) * span * ((cImr - pImr) / 1000);
    const pCo2 = avg(player.co2[i], player.co2[i + 1]);
    const cCo2 = avg(comparison.co2[i], comparison.co2[i + 1]);
    if (pCo2 === null || cCo2 === null || pop === null) co2Ok = false;
    else co2 += (pCo2 - cCo2) * pop * span;
  }
  const last = player.years.length - 1;
  const pE = player.electricity[last], cE = comparison.electricity[last];
  const popEnd = comparison.population[last] ?? player.population[last];
  return {
    infantLivesSaved: livesOk ? lives : null,
    peopleWithPower: pE != null && cE != null && popEnd != null ? ((pE - cE) / 100) * popEnd : null,
    extraCo2Tonnes: co2Ok ? co2 : null,
  };
}

function avg(a: number | null | undefined, b: number | null | undefined): number | null {
  return a == null || b == null ? null : (a + b) / 2;
}

/**
 * The same country, seed and world, but the government stays the course every turn.
 * Used to show what the player's policies achieved compared with doing nothing.
 */
export function stayTheCourse(state: GameState, turns = state.metricHistory.length - 1): GameState {
  let s = createGame(state.setup, { seed: state.seed, objective: state.objective, difficulty: state.difficulty });
  for (let t = 0; t < turns && s.phase !== "finished"; t++) {
    s = nextTurn(worldReaction(applyDecision(beginDecision(s), FALLBACK_POLICY)));
  }
  return s;
}

export function impactVsDoingNothing(state: GameState): Impact {
  const shadow = stayTheCourse(state);
  const years = state.metricHistory.map((h) => h.year);
  const cbr = state.realStart.birthRate?.value ?? null;
  return compareImpact(pathFromMetrics(years, state.metricHistory, cbr), pathFromMetrics(years, shadow.metricHistory, cbr));
}
