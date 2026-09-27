// Development scores. Documented in README "Scoring".
// indicator score = 50 + 50 * tanh(signed change / scale)
//   change: logRatio = ln(end / start); difference = end - start; gapClosed = (end - start) / (100 - start)
//           towardTarget = |start - 100| - |end - 100| (gross enrollment above 100% means over-age or repeating pupils)
//   signed: flipped when lower is better
// category score = mean of its indicator scores with data; 50 means "no change from the start".
import { INDICATORS, INDICATOR_IDS, SCORE_CATEGORIES, type IndicatorId } from "../worldbank/indicators";
import { OBJECTIVES } from "./rules";
import type { Objective } from "./types";

export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];
export type Values = Partial<Record<IndicatorId, number | null | undefined>>;

export function indicatorChange(id: IndicatorId, start: number, end: number): number | null {
  const def = INDICATORS[id];
  if (def.normalization === "logRatio") return start > 0 && end > 0 ? Math.log(end / start) : null;
  if (def.normalization === "gapClosed") return start < 100 ? (end - start) / (100 - start) : end >= 100 ? 0 : null;
  if (def.normalization === "towardTarget") return Math.abs(start - 100) - Math.abs(end - 100);
  return end - start;
}

/**
 * Is value `a` better than value `b` for this indicator? Uses the same rule as the score:
 * gross enrollment is better the closer it is to 100%; otherwise by the indicator's direction.
 * Returns null when the indicator has no better direction.
 */
export function isBetter(id: IndicatorId, a: number, b: number): boolean | null {
  const def = INDICATORS[id];
  if (def.normalization === "towardTarget") return Math.abs(a - 100) < Math.abs(b - 100);
  if (def.higherIsBetter === null) return null;
  return (a > b) === def.higherIsBetter;
}

/** True when two values are too close to call a difference (under 1% of the value, or tiny). */
export function roughlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < Math.max(0.05, Math.abs(b) * 0.01);
}

export function indicatorScore(id: IndicatorId, start: number | null | undefined, end: number | null | undefined): number | null {
  if (start === null || start === undefined || end === null || end === undefined) return null;
  const def = INDICATORS[id];
  const change = indicatorChange(id, start, end);
  if (change === null || def.higherIsBetter === null) return null;
  const signed = def.higherIsBetter ? change : -change;
  return 50 + 50 * Math.tanh(signed / def.scoreScale);
}

export function categoryScores(start: Values, end: Values, only?: Set<IndicatorId>): Record<ScoreCategory, number | null> {
  const out = {} as Record<ScoreCategory, number | null>;
  for (const category of SCORE_CATEGORIES) {
    const scores = INDICATOR_IDS.filter((id) => INDICATORS[id].scored && INDICATORS[id].category === category && (!only || only.has(id)))
      .map((id) => indicatorScore(id, start[id], end[id]))
      .filter((s): s is number => s !== null);
    out[category] = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }
  return out;
}

/** Objective-weighted total. Categories without data are dropped and the remaining weights renormalized. */
export function objectiveScore(scores: Record<ScoreCategory, number | null>, objective: Objective): number | null {
  const weights = OBJECTIVES[objective].weights;
  let total = 0, weight = 0;
  for (const category of SCORE_CATEGORIES) {
    const s = scores[category];
    if (s === null || weights[category] === 0) continue;
    total += s * weights[category];
    weight += weights[category];
  }
  return weight ? total / weight : null;
}

export interface HistoryDelta {
  player: Record<ScoreCategory, number | null>;
  historical: Record<ScoreCategory, number | null>;
  delta: Record<ScoreCategory, number | null>;
  playerTotal: number | null;
  historicalTotal: number | null;
  comparedIndicators: IndicatorId[];
  biggestSuccess: { id: IndicatorId; gap: number } | null;
  biggestTradeoff: { id: IndicatorId; gap: number } | null;
}

/**
 * Compare the player's final simulated values with real final values, using the same start and
 * the same formulas. Only indicators with a real end value are compared, on both sides.
 */
export function historyDelta(start: Values, playerEnd: Values, historicalEnd: Values, objective: Objective): HistoryDelta {
  const compared = INDICATOR_IDS.filter((id) => INDICATORS[id].scored && start[id] != null && playerEnd[id] != null && historicalEnd[id] != null);
  const only = new Set(compared);
  const player = categoryScores(start, playerEnd, only);
  const historical = categoryScores(start, historicalEnd, only);
  const delta = {} as Record<ScoreCategory, number | null>;
  for (const c of SCORE_CATEGORIES) delta[c] = player[c] !== null && historical[c] !== null ? player[c]! - historical[c]! : null;
  const gaps = compared.map((id) => ({ id, gap: indicatorScore(id, start[id], playerEnd[id])! - indicatorScore(id, start[id], historicalEnd[id])! }));
  gaps.sort((a, b) => b.gap - a.gap);
  return {
    player,
    historical,
    delta,
    playerTotal: objectiveScore(player, objective),
    historicalTotal: objectiveScore(historical, objective),
    comparedIndicators: compared,
    biggestSuccess: gaps.length && gaps[0].gap > 0 ? gaps[0] : null,
    biggestTradeoff: gaps.length && gaps[gaps.length - 1].gap < 0 ? gaps[gaps.length - 1] : null,
  };
}
