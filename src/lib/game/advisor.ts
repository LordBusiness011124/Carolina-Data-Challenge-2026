// AI policy advisor: Monte Carlo planning over the game's own deterministic model.
//
// For each policy on offer, the advisor plays many simulated futures to the end of the game and
// averages the objective score. It never sees what will really happen:
//   - world conditions after the current year are frozen at today's values (no world foresight);
//   - every rollout uses its own seed, so real upcoming events and dice are unknown;
//   - later turns in a rollout use randomly chosen affordable policies.
// No language model is involved; the recommendation is reproducible for a given game state.
import { mulberry32, hashString } from "./rng";
import { categoryScores, objectiveScore, type Values } from "./scoring";
import { applyDecision, beginDecision, canAfford, cloneState, nextTurn, policyOptions, worldReaction } from "./simulation";
import { FALLBACK_POLICY, POLICIES } from "./rules";
import type { GameState, SimulatedMetrics } from "./types";
import type { IndicatorId } from "../worldbank/indicators";

export interface OptionForecast {
  policyId: string;
  title: string;
  expectedScore: number;
  /** Expected score minus the expected score of staying the course. */
  vsStay: number;
  low: number;
  high: number;
  /** Average change in key indicators two years after choosing this option. */
  nearTerm: Partial<Record<IndicatorId, number>>;
}

export interface Advice {
  best: OptionForecast;
  options: OptionForecast[];
  rollouts: number;
  explanation: string;
}

const NEAR_TERM: IndicatorId[] = ["gdpPerCapita", "lifeExpectancy", "infantMortality", "electricity", "co2", "unemployment"];

function startValues(state: GameState): Values {
  return Object.fromEntries(Object.entries(state.realStart).map(([k, v]) => [k, v?.value]));
}

export function finalScore(state: GameState): number {
  return objectiveScore(categoryScores(startValues(state), state.metrics), state.objective) ?? 50;
}

/** The same game with world conditions after the current turn frozen at current values. */
function blindfold(state: GameState): GameState {
  const now = state.setup.world[state.turn - 1];
  const world = state.setup.world.map((w, i) => (i >= state.turn ? { ...w, values: now.values } : w));
  return { ...state, setup: { ...state.setup, world } };
}

/** Play from a decision-phase state to the end, choosing later policies at random. */
function rollout(start: GameState, policyId: string, seed: string): { final: GameState; afterTurn: SimulatedMetrics } {
  const random = mulberry32(hashString(seed));
  let s: GameState = { ...cloneState(start), seed };
  s = worldReaction(applyDecision(s, policyId));
  const afterTurn = { ...s.metrics };
  s = nextTurn(s);
  while (s.phase !== "finished") {
    s = beginDecision(s);
    const choices = policyOptions(s).filter((p) => p.id !== FALLBACK_POLICY && canAfford(s, p));
    const pick = choices.length ? choices[Math.floor(random() * choices.length)].id : FALLBACK_POLICY;
    s = nextTurn(worldReaction(applyDecision(s, pick)));
  }
  return { final: s, afterTurn };
}

export function advise(state: GameState, rollouts = 16): Advice {
  if (state.phase !== "decision") throw new Error("The advisor can only be consulted during a decision");
  const blind = blindfold(state);
  const forecasts: OptionForecast[] = [];
  for (const policy of policyOptions(state).filter((p) => canAfford(state, p))) {
    const scores: number[] = [];
    const near: Partial<Record<IndicatorId, number[]>> = {};
    for (let r = 0; r < rollouts; r++) {
      const { final, afterTurn } = rollout(blind, policy.id, `${state.seed}~advisor~${state.turn}~${r}`);
      scores.push(finalScore(final));
      for (const id of NEAR_TERM) if (afterTurn[id] !== undefined && state.metrics[id] !== undefined) (near[id] ??= []).push(afterTurn[id]! - state.metrics[id]!);
    }
    scores.sort((a, b) => a - b);
    forecasts.push({
      policyId: policy.id,
      title: policy.title,
      expectedScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      vsStay: 0,
      low: scores[Math.floor(scores.length * 0.1)],
      high: scores[Math.ceil(scores.length * 0.9) - 1],
      nearTerm: Object.fromEntries(Object.entries(near).map(([k, v]) => [k, v!.reduce((a, b) => a + b, 0) / v!.length])),
    });
  }
  forecasts.sort((a, b) => b.expectedScore - a.expectedScore);
  const stay = forecasts.find((f) => f.policyId === FALLBACK_POLICY);
  for (const f of forecasts) f.vsStay = stay ? f.expectedScore - stay.expectedScore : 0;
  const best = forecasts[0];
  const runnerUp = forecasts[1];
  const margin = runnerUp ? best.expectedScore - runnerUp.expectedScore : 0;
  const explanation = `Across ${rollouts} simulated futures per option, ${best.title} gave the best average ${state.objective === "balanced" ? "balanced development" : "mission"} score (${best.expectedScore.toFixed(1)})` +
    (runnerUp ? `, ${margin < 0.5 ? "only narrowly" : `${margin.toFixed(1)} points`} ahead of ${runnerUp.title}.` : ".") +
    " Futures assume today's world conditions continue and unknown events; real outcomes will differ.";
  return { best, options: forecasts, rollouts, explanation };
}

export function consumeAdvisor(state: GameState): GameState {
  if (state.advisorUses <= 0) throw new Error("No advisor consultations left");
  return { ...state, advisorUses: state.advisorUses - 1 };
}

/**
 * The AI plays the whole game itself: same country, seed, objective and difficulty as the player,
 * facing the same real events. Each turn it follows its own advice. Yields after every turn so the UI stays responsive.
 */
export async function autoplay(initial: GameState, rollouts = 8, regionLeader?: (s: GameState) => boolean, onTurn?: (turn: number) => void): Promise<GameState> {
  let s = initial;
  while (s.phase !== "finished") {
    s = beginDecision(s);
    const choice = advise(s, rollouts).best.policyId;
    s = nextTurn(worldReaction(applyDecision(s, choice), { regionLeader: regionLeader?.(s) ?? false }));
    onTurn?.(s.turn);
    await new Promise((r) => setTimeout(r, 0));
  }
  return s;
}

export function policyTitle(id: string) {
  return POLICIES[id]?.title ?? id;
}
