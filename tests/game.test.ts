import { describe, expect, it } from "vitest";
import { buildStartPackage } from "@/lib/worldbank/package";
import { applyDecision, canAfford, beginDecision, createGame, eventContext, nextTurn, policyOptions, worldReaction } from "@/lib/game/simulation";
import { EVENTS, POLICIES } from "@/lib/game/rules";
import { categoryScores, historyDelta, indicatorScore } from "@/lib/game/scoring";
import type { GameState } from "@/lib/game/types";
import { fixtureSeries, fixtureWorld, TEST_COUNTRY } from "./fixtures/series";

const setup = buildStartPackage(TEST_COUNTRY, fixtureSeries(), fixtureWorld(), fixtureWorld(), 1995, "SE.PRM.ENRR");
const newGame = (seed = "test-seed") => createGame(setup, { seed, objective: "balanced", difficulty: "normal" });

function playTurn(state: GameState, pickIndex = 0): GameState {
  let s = beginDecision(state);
  const options = policyOptions(s).filter((p) => canAfford(s, p));
  s = applyDecision(s, options[pickIndex % options.length].id);
  s = worldReaction(s);
  return nextTurn(s);
}

function playGame(seed: string, picks: number[]): GameState {
  let s = newGame(seed);
  for (const p of picks) s = playTurn(s, p);
  return s;
}

describe("policy effects", () => {
  it("charges costs, applies mechanics and schedules delayed effects", () => {
    const s = beginDecision(newGame());
    const policy = policyOptions(s)[0];
    const after = applyDecision(s, policy.id);
    expect(after.politicalCapital).toBeLessThanOrEqual(s.politicalCapital - policy.cost.politicalCapital + (policy.mechanics.politicalCapital ?? 0));
    expect(after.activeEffects).toHaveLength(policy.delayed.length);
    expect(after.phase).toBe("consequence");
    expect(after.decisionHistory[0].policyId).toBe(policy.id);
  });

  it("rejects policies that are not offered this turn", () => {
    const s = beginDecision(newGame());
    const other = Object.keys(POLICIES).find((id) => !policyOptions(s).some((p) => p.id === id))!;
    expect(() => applyDecision(s, other)).toThrow();
  });

  it("changes the simulated timeline compared with a different decision", () => {
    const a = worldReaction(applyDecision(beginDecision(newGame()), policyOptions(beginDecision(newGame()))[0].id));
    const b = worldReaction(applyDecision(beginDecision(newGame()), policyOptions(beginDecision(newGame()))[1].id));
    expect(JSON.stringify(a.metrics)).not.toEqual(JSON.stringify(b.metrics));
  });
});

describe("delayed effects", () => {
  it("activate after their delay and expire after their duration", () => {
    let s = beginDecision(newGame());
    s.currentProblemId = "power_shortage";
    s = applyDecision(s, "grid_expansion");
    const effect = s.activeEffects[0];
    expect(effect.startsTurn).toBe(2);
    expect(effect.endsTurn).toBe(5);
    s = nextTurn(worldReaction(s));
    expect(s.activeEffects.some((e) => e.id === effect.id)).toBe(true);
    for (let i = 0; i < 4; i++) s = playTurn(s);
    expect(s.activeEffects.some((e) => e.id === effect.id)).toBe(false);
  });

  it("produce a callback when they begin", () => {
    let s = beginDecision(newGame());
    s.currentProblemId = "power_shortage";
    s = nextTurn(worldReaction(applyDecision(s, "grid_expansion")));
    s = beginDecision(s);
    s = worldReaction(applyDecision(s, policyOptions(s).find((p) => s.politicalCapital >= p.cost.politicalCapital)!.id));
    expect(s.lastReaction!.callbacks.join(" ")).toMatch(/2 years on: Factories connected/);
  });
});

describe("world events", () => {
  it("weight slowdowns by world data and trade exposure", () => {
    const s = newGame();
    const context = { ...eventContext(s), worldGrowth: -1.3, worldGrowthPrev: 3 };
    const slowdown = EVENTS.find((e) => e.id === "global_slowdown")!;
    const boom = EVENTS.find((e) => e.id === "global_boom")!;
    expect(slowdown.weight(context)).toBeGreaterThan(boom.weight(context));
    expect(slowdown.severity({ ...context, tradeExposure: 1.5 })).toBeGreaterThan(slowdown.severity({ ...context, tradeExposure: 0.3 }));
  });

  it("apply event effects to mechanics and record them", () => {
    const s = worldReaction(applyDecision(beginDecision(newGame()), policyOptions(beginDecision(newGame()))[0].id));
    expect(s.eventHistory).toHaveLength(1);
    expect(s.currentYear).toBe(1997);
    expect(s.metricHistory).toHaveLength(2);
  });
});

describe("reproducibility", () => {
  it("same seed and decisions give identical outcomes", () => {
    expect(JSON.stringify(playGame("alpha", [0, 1, 2, 3, 0, 1]))).toEqual(JSON.stringify(playGame("alpha", [0, 1, 2, 3, 0, 1])));
  });
  it("a different seed can change world reactions", () => {
    const seeds = ["a", "b", "c", "d", "e"].map((seed) => playGame(seed, [0, 0, 0, 0, 0, 0]).eventHistory.map((e) => e.eventId).join());
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });
  it("a full game finishes after ten turns with plausible values", () => {
    const s = playGame("full", [0, 1, 2, 3, 0, 1, 2, 3, 0, 1]);
    expect(s.phase).toBe("finished");
    expect(s.currentYear).toBe(2015);
    expect(s.metrics.lifeExpectancy!).toBeLessThanOrEqual(84);
    expect(s.metrics.electricity!).toBeLessThanOrEqual(100);
    expect(s.metrics.gdpPerCapita!).toBeGreaterThan(0);
  });
});

describe("scoring", () => {
  it("scores no change as 50 and direction by indicator", () => {
    expect(indicatorScore("lifeExpectancy", 60, 60)).toBe(50);
    expect(indicatorScore("lifeExpectancy", 60, 66)).toBeGreaterThan(50);
    expect(indicatorScore("infantMortality", 40, 20)).toBeGreaterThan(50);
    expect(indicatorScore("co2", 1, 2)).toBeLessThan(50);
    expect(indicatorScore("lifeExpectancy", null, 60)).toBeNull();
  });
  it("scores gross enrollment by distance from 100 percent", () => {
    expect(indicatorScore("education", 116, 104)).toBeGreaterThan(50);
    expect(indicatorScore("education", 80, 95)).toBeGreaterThan(50);
    expect(indicatorScore("education", 100, 115)).toBeLessThan(50);
  });
  it("averages categories and skips missing indicators", () => {
    const scores = categoryScores({ lifeExpectancy: 60, infantMortality: 40 }, { lifeExpectancy: 66 });
    expect(scores.health).toBeCloseTo(indicatorScore("lifeExpectancy", 60, 66)!);
    expect(scores.economy).toBeNull();
  });
  it("computes history delta over indicators with real end values only", () => {
    const start = { lifeExpectancy: 60, infantMortality: 40, co2: 1 };
    const d = historyDelta(start, { lifeExpectancy: 70, infantMortality: 20, co2: 3 }, { lifeExpectancy: 66, infantMortality: null, co2: 2 }, "balanced");
    expect(d.comparedIndicators).toEqual(["lifeExpectancy", "co2"]);
    expect(d.delta.health!).toBeGreaterThan(0);
    expect(d.delta.sustainability!).toBeLessThan(0);
    expect(d.biggestSuccess?.id).toBe("lifeExpectancy");
    expect(d.biggestTradeoff?.id).toBe("co2");
  });
});

describe("no dead ends", () => {
  it("always offers a free option, even with no treasury or political capital", () => {
    const s = beginDecision(newGame());
    s.politicalCapital = 0;
    s.treasury = -20;
    const affordable = policyOptions(s).filter((p) => canAfford(s, p));
    expect(affordable.map((p) => p.id)).toContain("status_quo");
    expect(applyDecision(s, "status_quo").phase).toBe("consequence");
  });
});

describe("school enrollment stays realistic", () => {
  it("does not stop at exactly 100% or run away above it", () => {
    for (const startValue of [70, 98, 102.5, 112]) {
      const base = newGame(`edu-${startValue}`);
      let s: GameState = { ...base, metrics: { ...base.metrics, education: startValue }, metricHistory: [{ year: 1995, metrics: { ...base.metrics, education: startValue } }] };
      while (s.phase !== "finished") s = nextTurn(worldReaction(applyDecision(beginDecision(s), "status_quo")));
      for (const h of s.metricHistory.slice(1)) {
        expect(h.metrics.education).not.toBe(100);
        expect(h.metrics.education!).toBeLessThan(112.5);
      }
    }
  });
});
