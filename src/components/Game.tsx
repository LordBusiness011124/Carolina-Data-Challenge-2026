"use client";
import { useMemo, useState } from "react";
import { advise, consumeAdvisor, type Advice } from "@/lib/game/advisor";
import { impactVsDoingNothing } from "@/lib/game/impact";
import { applyDecision, beginDecision, createGame, nextTurn, worldReaction } from "@/lib/game/simulation";
import type { GameState } from "@/lib/game/types";
import type { StartPackage } from "@/lib/worldbank/package";
import type { RivalsPackage } from "@/lib/worldbank/rivals";
import { isRegionLeader, standingsFor } from "./Board";
import { HowItWorks } from "./HowItWorks";
import { CountryBriefing, Dashboard } from "./Play";
import { Reveal } from "./Reveal";
import { Landing, Setup, useCountries, type SetupChoice } from "./Setup";

type Screen = "landing" | "setup" | "briefing" | "play" | "reveal";

export default function Game() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [state, setState] = useState<GameState | null>(null);
  const [choice, setChoice] = useState<SetupChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [rivals, setRivals] = useState<RivalsPackage | null>(null);
  const [rivalsError, setRivalsError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const { countries } = useCountries();

  function loadRivals(c: SetupChoice) {
    setRivals(null);
    setRivalsError(null);
    fetch(`/api/rivals?country=${c.country}&year=${c.year}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error))))
      .then((d: RivalsPackage) => setRivals(d))
      .catch((e) => setRivalsError(`${e.message ?? e} The board is unavailable; the game still works.`));
  }

  async function start(c: SetupChoice) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/start?country=${c.country}&year=${c.year}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load World Bank data.");
      setChoice(c);
      setAdvice(null);
      setState(createGame(body as StartPackage, { seed: c.seed, objective: c.objective, difficulty: c.difficulty }));
      loadRivals(c);
      setScreen("briefing");
      window.scrollTo(0, 0);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : String(e)} Retry to try again.`);
    } finally {
      setBusy(false);
    }
  }

  const act = (fn: (s: GameState) => GameState) => {
    if (!state) return;
    const next = fn(state);
    setState(next);
    if (next.phase !== "decision") setAdvice(null);
    if (next.phase === "finished") setScreen("reveal");
    window.scrollTo(0, 0);
  };

  const regionLeader = (s: GameState) => isRegionLeader(standingsFor(s, rivals));

  function consult() {
    if (!state || state.advisorUses <= 0) return;
    setAdviceBusy(true);
    // Let the spinner render before the simulations run.
    setTimeout(() => {
      try {
        setAdvice(advise(state, 16));
        setState(consumeAdvisor(state));
      } finally {
        setAdviceBusy(false);
      }
    }, 30);
  }

  const impact = useMemo(() => (state && state.metricHistory.length > 1 ? impactVsDoingNothing(state) : null), [state]);

  return (
    <>
      {screen === "landing" && <Landing onStart={() => setScreen("setup")} onHowItWorks={() => setHelp(true)} />}
      {screen === "setup" && <Setup onConfirm={start} onBack={() => setScreen("landing")} busy={busy} error={error} />}
      {screen === "briefing" && state && <CountryBriefing state={state} onBegin={() => setScreen("play")} />}
      {screen === "play" && state && (
        <Dashboard state={state} onHowItWorks={() => setHelp(true)} rivals={rivals} rivalsError={rivalsError} countries={countries ?? []}
          advice={advice} adviceBusy={adviceBusy} onConsult={consult} impact={impact}
          onBeginDecision={() => act(beginDecision)} onDecide={(id) => act((s) => applyDecision(s, id))}
          onReact={() => act((s) => worldReaction(s, { regionLeader: regionLeader(s) }))} onNext={() => act(nextTurn)} />
      )}
      {screen === "reveal" && state && (
        <Reveal state={state} rivals={rivals} regionLeader={regionLeader} onRestart={() => { setState(null); setScreen("setup"); }} onReplay={() => choice && start(choice)} />
      )}
      <HowItWorks open={help} onClose={() => setHelp(false)} />
    </>
  );
}
