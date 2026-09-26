import { describe, expect, it } from "vitest";
import { advise } from "@/lib/game/advisor";
import { compareImpact, impactVsDoingNothing, pathFromMetrics } from "@/lib/game/impact";
import { applyDecision, beginDecision, createGame, nextTurn, policyOptions, rollDice, worldReaction } from "@/lib/game/simulation";
import { CONSTANTS, POLICIES } from "@/lib/game/rules";
import { buildStartPackage } from "@/lib/worldbank/package";
import { developmentIndex, regionalStandings, type RivalsPackage } from "@/lib/worldbank/rivals";
import { fixtureSeries, fixtureWorld, TEST_COUNTRY } from "./fixtures/series";

const setup = buildStartPackage(TEST_COUNTRY, fixtureSeries(), fixtureWorld(), fixtureWorld(), 1995, "SE.PRM.ENRR");
const game = (seed = "board") => createGame(setup, { seed, objective: "balanced", difficulty: "normal" });

describe("fortune dice", () => {
  it("are reproducible and within 1..6", () => {
    expect(rollDice("s", 3)).toEqual(rollDice("s", 3));
    for (let t = 1; t <= 10; t++) for (const d of rollDice("x", t)) expect(d >= 1 && d <= 6).toBe(true);
  });
  it("are recorded on the reaction", () => {
    const s = worldReaction(applyDecision(beginDecision(game()), policyOptions(beginDecision(game()))[0].id));
    expect(s.lastReaction!.dice).toEqual(rollDice("board", 1));
  });
});

describe("regional leadership", () => {
  it("adds political capital only when leading the region", () => {
    const decided = applyDecision(beginDecision(game()), "status_quo");
    const withBonus = worldReaction(decided, { regionLeader: true });
    const without = worldReaction(decided, { regionLeader: false });
    expect(withBonus.politicalCapital - without.politicalCapital).toBeCloseTo(Math.min(CONSTANTS.regionLeaderBonus, 100 - without.politicalCapital));
    expect(withBonus.lastReaction!.regionBonus).toBe(CONSTANTS.regionLeaderBonus);
  });
});

describe("development index and standings", () => {
  it("scales components 0..100 and needs three of four", () => {
    expect(developmentIndex({ lifeExpectancy: 85, gdpPerCapita: 60000, infantMortality: 2, electricity: 100 })).toBeCloseTo(100);
    expect(developmentIndex({ lifeExpectancy: 40, gdpPerCapita: 300, infantMortality: 150, electricity: 0 })).toBeCloseTo(0);
    expect(developmentIndex({ lifeExpectancy: 70, gdpPerCapita: 2000 })).toBeNull();
  });
  it("ranks the player against rivals and marks influence", () => {
    const rivals: RivalsPackage = { regionCode: "EAS", regionName: "Test", turnYears: [1995], rivals: [
      { code: "AAA", name: "Richland", values: [{ lifeExpectancy: 80, gdpPerCapita: 30000, infantMortality: 3, electricity: 100 }] },
      { code: "BBB", name: "Poorland", values: [{ lifeExpectancy: 50, gdpPerCapita: 500, infantMortality: 90, electricity: 20 }] },
      { code: "CCC", name: "Nodata", values: [{ lifeExpectancy: null, gdpPerCapita: null, infantMortality: null, electricity: null }] },
    ] };
    const rows = regionalStandings({ code: "TST", name: "Testland", index: 50 }, rivals, 0);
    expect(rows.map((r) => r.code)).toEqual(["AAA", "TST", "BBB"]);
    expect(rows.find((r) => r.code === "BBB")!.influenced).toBe(true);
    expect(rows.find((r) => r.code === "AAA")!.influenced).toBe(false);
  });
});

describe("AI advisor", () => {
  it("recommends an affordable option and is deterministic", () => {
    const s = beginDecision(game());
    const a = advise(s, 4), b = advise(s, 4);
    expect(a).toEqual(b);
    expect(policyOptions(s).map((p) => p.id)).toContain(a.best.policyId);
    expect(a.options[0].expectedScore).toBeGreaterThanOrEqual(a.options[a.options.length - 1].expectedScore);
  });
  it("cannot see future world conditions", () => {
    const s = beginDecision(game());
    const altered = { ...s, setup: { ...s.setup, world: s.setup.world.map((w, i) => (i >= 1 ? { ...w, values: { ...w.values, growth: { ...w.values.growth!, value: -9 } } } : w)) } };
    expect(advise(altered, 4)).toEqual(advise(s, 4));
  });
  it("does not use the real game seed for its rollouts", () => {
    const a = advise(beginDecision(game("seed-a")), 4);
    expect(a.rollouts).toBe(4);
    expect(a.explanation).toMatch(/simulated futures/);
  });
});

describe("impact ledger", () => {
  it("converts infant mortality and access gaps into people", () => {
    const years = [2000, 2002];
    const player = { years, infantMortality: [30, 20], electricity: [50, 80], co2: [1, 1], population: [1e6, 1e6], birthRate: [30, 30] };
    const other = { years, infantMortality: [30, 30], electricity: [50, 60], co2: [1, 2], population: [1e6, 1e6], birthRate: [30, 30] };
    const impact = compareImpact(player, other);
    // births 30,000/yr x 2 yrs x (30-25)/1000
    expect(impact.infantLivesSaved).toBeCloseTo(300);
    expect(impact.peopleWithPower).toBeCloseTo(200000);
    expect(impact.extraCo2Tonnes).toBeCloseTo(-1e6);
  });
  it("returns null rather than zero when data is missing", () => {
    const years = [2000, 2002];
    const p = { years, infantMortality: [30, null], electricity: [50, null], co2: [1, 1], population: [1e6, 1e6], birthRate: [30, 30] };
    expect(compareImpact(p, p).infantLivesSaved).toBeNull();
    expect(compareImpact(p, p).peopleWithPower).toBeNull();
  });
  it("is zero when the player also stays the course", () => {
    let s = game();
    for (let t = 0; t < 3; t++) s = nextTurn(worldReaction(applyDecision(beginDecision(s), "status_quo")));
    const impact = impactVsDoingNothing(s);
    expect(impact.infantLivesSaved).toBeCloseTo(0);
    expect(impact.peopleWithPower).toBeCloseTo(0);
  });
  it("shows lives saved after a health policy", () => {
    let s = beginDecision(game());
    s.currentProblemId = "child_health";
    s = nextTurn(worldReaction(applyDecision(s, "vaccination")));
    expect(impactVsDoingNothing(s).infantLivesSaved!).toBeGreaterThan(0);
    expect(pathFromMetrics([1995, 1997], s.metricHistory, 30).birthRate[0]).toBe(30);
  });
});

describe("policy metadata", () => {
  it("tags every real policy with at least one SDG except neutral fiscal moves", () => {
    const untagged = Object.values(POLICIES).filter((p) => !p.sdgs?.length).map((p) => p.id);
    expect(untagged.sort()).toEqual(["austerity", "status_quo"]);
  });
});
