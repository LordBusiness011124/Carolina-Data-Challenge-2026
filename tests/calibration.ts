// Plays many random games against real World Bank data and reports how the model compares with history.
// Run: npm run dev, then npx vitest run --config vitest.calibration.config.ts
import { it } from "vitest";
import { canAfford, applyDecision, beginDecision, createGame, nextTurn, policyOptions, worldReaction } from "@/lib/game/simulation";
import { historyDelta, type Values } from "@/lib/game/scoring";
import { mulberry32 } from "@/lib/game/rng";
import type { RevealPackage, StartPackage } from "@/lib/worldbank/package";

const BASE = process.env.GAME_URL || "http://localhost:3100";
const GAMES = Number(process.env.GAMES ?? 300);

it("calibration", async () => {
  for (const country of ["VNM", "BRA", "GHA"]) {
    const setup = await (await fetch(`${BASE}/api/setup?country=${country}`)).json();
    const start: StartPackage = await (await fetch(`${BASE}/api/start?country=${country}&year=${setup.defaultStart}`)).json();
    const reveal: RevealPackage = await (await fetch(`${BASE}/api/reveal?country=${country}&year=${start.startYear}&edu=${start.educationCode}`)).json();
    const real: Values = Object.fromEntries(Object.entries(reveal.history).map(([k, s]) => [k, s[10]?.value ?? null]));
    const startValues: Values = Object.fromEntries(Object.entries(start.start).map(([k, v]) => [k, v?.value]));
    let beats = 0;
    const totals: number[] = [];
    const finals: Record<string, number[]> = {};
    const deltas: Record<string, number[]> = {};
    for (let g = 0; g < GAMES; g++) {
      const random = mulberry32(g + 1);
      let s = createGame(start, { seed: `cal-${g}`, objective: "balanced", difficulty: "normal" });
      while (s.phase !== "finished") {
        s = beginDecision(s);
        const options = policyOptions(s).filter((p) => canAfford(s, p) && p.id !== "status_quo");
        s = nextTurn(worldReaction(applyDecision(s, (options.length ? options[Math.floor(random() * options.length)].id : "status_quo"))));
      }
      const d = historyDelta(startValues, s.metrics, real, "balanced");
      if (d.playerTotal! > d.historicalTotal!) beats++;
      totals.push(d.playerTotal! - d.historicalTotal!);
      for (const k of ["gdpPerCapita", "lifeExpectancy", "infantMortality", "electricity", "co2", "renewable", "education", "unemployment"]) (finals[k] ??= []).push(s.metrics[k as keyof typeof s.metrics] ?? NaN);
      for (const [k, v] of Object.entries(d.delta)) if (v !== null) (deltas[k] ??= []).push(v);
    }
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    console.log(`\n${country} ${start.startYear}-${start.endYear}: random play beats history ${((100 * beats) / GAMES).toFixed(0)}% · mean total gap ${avg(totals).toFixed(1)}`);
    console.log("  category gaps:", JSON.stringify(Object.fromEntries(Object.entries(deltas).map(([k, v]) => [k, +avg(v).toFixed(1)]))));
    console.log("  final sim avg vs real:", JSON.stringify(Object.fromEntries(Object.entries(finals).map(([k, v]) => [k, `${avg(v).toFixed(2)} vs ${real[k as keyof Values]?.toFixed(2)}`]))));
  }
});
