import { describe, expect, it } from "vitest";
import { ELECTION_EVERY_TURNS, politicalEvent } from "@/lib/game/politics";
import { relevance } from "@/lib/game/relevance";
import { POLICIES } from "@/lib/game/rules";
import { applyDecision, beginDecision, createGame, nextTurn, policyOptions, rankedOptions, worldReaction } from "@/lib/game/simulation";
import { chapterFor, type RealHistory } from "@/lib/game/story";
import type { GameState } from "@/lib/game/types";
import { buildStartPackage } from "@/lib/worldbank/package";
import { fixtureSeries, fixtureWorld, TEST_COUNTRY } from "./fixtures/series";

const setup = buildStartPackage(TEST_COUNTRY, fixtureSeries(), fixtureWorld(), fixtureWorld(), 1995, "SE.PRM.ENRR");
const game = (seed = "story", income = "Lower middle income") =>
  createGame({ ...setup, country: { ...setup.country, incomeLevel: income } }, { seed, objective: "balanced", difficulty: "normal" });

describe("country-relevant options", () => {
  it("offers four ranked options plus staying the course, each with a reason", () => {
    const s = beginDecision(game());
    const options = rankedOptions(s);
    expect(options).toHaveLength(6);
    expect(options[5].policy.id).toBe("status_quo");
    const disguised = options.filter((o) => o.policy.harmful);
    expect(disguised.length).toBeGreaterThanOrEqual(1);
    expect(disguised.length).toBeLessThanOrEqual(2);
    // Disguised options look positive: a flattering pitch, only positive hints, and a hidden truth.
    for (const o of disguised) {
      expect(o.reason).toBe(o.policy.pitch);
      expect(Object.values(o.policy.hints).every((h) => h.startsWith("+"))).toBe(true);
      expect(o.policy.truth!.length).toBeGreaterThan(20);
    }
    for (const o of options.slice(0, 4)) expect(o.reason.length).toBeGreaterThan(5);
  });
  it("does not offer coal power or basic vaccination to high-income countries", () => {
    const rich = game("rich", "High income");
    expect(relevance("coal_power", rich).score).toBeLessThan(0);
    expect(relevance("vaccination", rich).score).toBeLessThan(relevance("vaccination", game("poor", "Low income")).score);
    const s = beginDecision(rich);
    s.currentProblemId = "power_shortage";
    expect(policyOptions(s).map((p) => p.id)).not.toContain("coal_power");
  });
  it("ranks farming policy higher where agriculture is a large share of GDP", () => {
    const s = game();
    const farm = relevance("agri_modernize", { ...s, metrics: { ...s.metrics, agriculture: 40 } }).score;
    const city = relevance("agri_modernize", { ...s, metrics: { ...s.metrics, agriculture: 2 } }).score;
    expect(farm).toBeGreaterThan(city);
  });
});

describe("high-stakes reforms", () => {
  const withMetrics = (income: string, metrics: Record<string, number>, treasury = 60) => {
    const s = game("stakes", income);
    return { ...s, treasury, metrics: { ...s.metrics, ...metrics } };
  };
  it("only offers nationalization where resources matter", () => {
    expect(relevance("nationalize_resources", withMetrics("Upper middle income", { resourceRents: 0.5 })).score).toBeLessThan(0);
    expect(relevance("nationalize_resources", withMetrics("Lower middle income", { resourceRents: 25 })).score).toBeGreaterThan(1);
  });
  it("does not offer nuclear power to low-income economies", () => {
    expect(relevance("nuclear_plant", withMetrics("Low income", {})).score).toBeLessThan(0);
    expect(relevance("nuclear_plant", withMetrics("High income", { co2: 9 })).score).toBeGreaterThan(1);
  });
  it("makes an IMF program more relevant as the treasury empties", () => {
    expect(relevance("imf_program", withMetrics("Low income", {}, 10)).score).toBeGreaterThan(relevance("imf_program", withMetrics("Low income", {}, 70)).score);
  });
  it("gives every high-stakes reform a real risk and a delayed payoff or cost", () => {
    for (const id of ["imf_program", "fuel_subsidy_cut", "mega_dam", "privatize_power", "nationalize_resources", "sez_foreign_loans", "minimum_wage", "free_primary", "land_reform", "nuclear_plant"]) {
      expect(POLICIES[id].risk!.chance).toBeGreaterThanOrEqual(0.25);
      expect(POLICIES[id].delayed.length).toBeGreaterThan(0);
    }
  });
  it("only disguises options that are plausible for the country", () => {
    const s = beginDecision(withMetrics("High income", { resourceRents: 0.2, agriculture: 1 }));
    for (let turn = 1; turn <= 10; turn++) {
      const options = rankedOptions({ ...s, turn, currentProblemId: "investment_drought" });
      expect(options.map((o) => o.policy.id)).not.toContain("sell_resources");
    }
  });
});

describe("fictional political storyline", () => {
  it("holds an election every four years with results driven by public mood", () => {
    const s = { ...game(), turn: ELECTION_EVERY_TURNS };
    expect(politicalEvent({ ...s, satisfaction: 70 }, null).id).toBe("election_landslide");
    expect(politicalEvent({ ...s, satisfaction: 30 }, null).id).toBe("election_coalition");
  });
  it("is reproducible and recorded every turn", () => {
    let s = game();
    for (let t = 0; t < 3; t++) s = nextTurn(worldReaction(applyDecision(beginDecision(s), "status_quo")));
    expect(s.politicalHistory).toHaveLength(3);
    expect(politicalEvent({ ...game(), turn: 3 }, null)).toEqual(politicalEvent({ ...game(), turn: 3 }, null));
  });
});

describe("chronicle", () => {
  function played(): GameState {
    return worldReaction(applyDecision(beginDecision(game("chapter")), "status_quo"));
  }
  it("narrates the player's turn without real data", () => {
    const c = chapterFor(played(), 1, null)!;
    expect(c.title).toMatch(/^Chapter 1 · 1995–1997/);
    expect(c.decision).toMatch(/stay the course/);
    expect(c.real).toBeNull();
    expect(c.politics.headline.length).toBeGreaterThan(3);
  });
  it("adds what actually happened and a verdict from real values", () => {
    const s = played();
    const le = s.metricHistory.map((h) => h.metrics.lifeExpectancy!);
    const real: RealHistory = {
      lifeExpectancy: [
        { code: "SP.DYN.LE00.IN", requestedYear: 1995, observationYear: 1995, value: le[0], isEstimated: false, obsStatus: null, source: "World Bank Indicators API" },
        { code: "SP.DYN.LE00.IN", requestedYear: 1997, observationYear: 1997, value: le[1] + 3, isEstimated: false, obsStatus: null, source: "World Bank Indicators API" },
      ],
    };
    const c = chapterFor(s, 1, real)!;
    expect(c.real).toMatch(/In the real Testland, 1995–1997 \(World Bank data\)/);
    expect(c.verdict).toMatch(/real Testland is ahead of yours on life expectancy/);
    expect(c.comparison[0]).toMatchObject({ id: "lifeExpectancy", ahead: false });
  });
});

describe("chronicle wording", () => {
  it("keeps acronyms capitalized mid-sentence", async () => {
    const { inSentence } = await import("@/lib/game/story");
    expect(inSentence("GDP per capita")).toBe("GDP per capita");
    expect(inSentence("CO2 per person")).toBe("CO2 per person");
    expect(inSentence("Life expectancy")).toBe("life expectancy");
  });
});

/** A decision-phase state where a given policy is on offer (searching problems and seeds). */
function offering(policyId: string): GameState {
  for (let i = 0; i < 200; i++) {
    const s = beginDecision(game(`find-${i}`));
    for (const problem of ["jobs_crisis", "child_health", "fiscal_squeeze", "power_shortage", "unrest", "rural_stagnation", "investment_drought", "emissions"]) {
      const candidate = { ...s, currentProblemId: problem };
      if (policyOptions(candidate).some((p) => p.id === policyId)) return candidate;
    }
  }
  throw new Error(`${policyId} never offered`);
}

describe("greed and bad governance", () => {
  it("adds corrupt earnings to the hidden fortune", () => {
    const after = applyDecision(offering("skim_funds"), "skim_funds");
    expect(after.personalWealth).toBe(POLICIES.skim_funds.enrichment);
  });
  it("makes corruption scandals likelier as the fortune grows", () => {
    const s = { ...game(), turn: 3 };
    const exposed = (wealth: number) => Array.from({ length: 40 }, (_, i) => politicalEvent({ ...s, seed: `x${i}`, personalWealth: wealth }, null).id).filter((id) => id === "corruption_exposed").length;
    expect(exposed(0)).toBe(0);
    expect(exposed(300)).toBeGreaterThan(exposed(40));
  });
  it("leaves people worse off than responsible choices", () => {
    const play = (pick: (s: GameState) => string) => {
      let s = game("compare");
      while (s.phase !== "finished") {
        s = beginDecision(s);
        s = nextTurn(worldReaction(applyDecision(s, pick(s))));
      }
      return s;
    };
    const greedy = play((s) => rankedOptions(s).find((o) => o.policy.harmful)!.policy.id);
    const decent = play((s) => rankedOptions(s).find((o) => !o.policy.harmful && s.politicalCapital >= o.policy.cost.politicalCapital)!.policy.id);
    expect(greedy.metrics.infantMortality!).toBeGreaterThan(decent.metrics.infantMortality!);
    expect(greedy.personalWealth).toBeGreaterThan(0);
  });
  it("reveals the truth in the chronicle after a disguised choice", () => {
    const after = worldReaction(applyDecision(offering("crony_megaprojects"), "crony_megaprojects"));
    const chapter = chapterFor(after, 1, null)!;
    expect(chapter.decision).toContain(POLICIES.crony_megaprojects.truth!);
    expect(chapter.decision).toMatch(/million quietly found its way into your private accounts/);
  });
});

describe("event wording", () => {
  it("never says good news 'hit hard'", () => {
    for (let i = 0; i < 300; i++) {
      const s = worldReaction(applyDecision(beginDecision(game(`words-${i}`)), "status_quo"));
      const e = s.eventHistory[0];
      const text = chapterFor(s, 1, null)!.world;
      if (["global_boom", "commodity_boom", "fdi_opportunity", "trade_expansion", "tech_boom", "calm"].includes(e.eventId)) {
        expect(text).not.toMatch(/hit hard|softening the blow/);
      }
    }
  });
});
