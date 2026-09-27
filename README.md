# Humanity's Next Move

**Big problems can feel overwhelming. This game shows that change is possible.**

Poverty, disease and climate change are so large that many people feel nothing they do could matter. The real record says otherwise: World Bank data shows the world has more than halved infant mortality since 1990, and added years to the average life. Those gains came from choices. Humanity's Next Move puts those choices in your hands.

Humanity's Next Move is a turn-based strategy board game built on real historical development data from the [World Bank Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation). Pick any country on a world map (187 of the 217 countries in the API have enough data), take office in a real year, and govern for 20 years. Your region is the board: out-develop your real-world neighbors to spread your influence, roll the fortune dice each turn, and choose from realistic, high-stakes policies tailored to your country, some of which are not what they seem. After every decision the game tells the story of what happened in your timeline and what actually happened in the real country, chapter by chapter. At the end it reveals the full real trajectory and the lives your choices saved or lost: could you beat history?

Built for the **AI for Social Good** theme. You win by saving lives and extending electricity, schooling and incomes, never by conquest.

*Historical development data provided by the World Bank Indicators API.*

## Why we built it

People feel overwhelmed by the world's problems, and that feeling can turn into giving up. We wanted to show, with real data, that change is possible: that specific decisions about clinics, schools, power and budgets save or cost real lives, and that humanity has already made enormous progress by making such decisions.

Development statistics are usually read as dashboards. Humanity's Next Move turns them into decisions with tradeoffs: electrify fast with coal or slowly with renewables, spend on clinics or on factories, borrow now or cut spending. Then it compares your choices with the path the country actually took.

## Change is possible: how the game makes the point

- **Proof on the landing page.** A live World Bank panel (WLD aggregate) shows how far the world has come since 1990 in infant mortality, life expectancy and electricity access. The numbers come from the API on every load, not from hard-coded values.
- **A reminder at the start.** The national briefing tells players that every number on the page is made of choices, and choices can change it.
- **Your impact at the end.** The final screen says, in the player's own numbers, how many babies their decisions kept alive and how many people they brought electricity to, compared with doing nothing, and what real progress the country made over the same years. It closes with the line "Humanity's next move is yours."

## The board-game layer

- **The world map** shows every country from the World Bank country API. Clicking one checks its data coverage live and lists playable start years.
- **Regional influence.** The other countries in your World Bank region are your rivals, shown with their real data for each turn year. A simple development index (life expectancy, GDP per capita, infant mortality, electricity) ranks everyone. Rivals you out-develop turn to your color on the regional map. Leading at least half the region earns +4 political capital per turn, like holding a continent.
- **Fortune dice.** Each world event comes with two seeded dice. Their total scales the event from 0.7× to 1.3× strength.
- **Mission cards.** The four objectives are drawn as mission cards and decide how your final score is weighted.
- **Four steps per turn:** Intel, Deploy, Resolve, Fortune.

The theme borrows the feel of classic world-map strategy games but uses its own names, rules and art, and replaces conquest with development.

## AI for Social Good

- **Bad choices in disguise.** Every turn mixes one, sometimes two, harmful choices in among the genuine options, dressed up with respectable names and pitches: a Discretionary Development Fund (a slush fund), a Grand Presidential Palace and National Stadium (crony contracts), a Household Contribution Levy (a flat tax that hits the poorest), Streamline Public Services (cuts to clinics and schools), a National Unity Media Act (censorship), Cut Red Tape for Industry (pollution for donations), Central Bank Stimulus (printing money) and Strategic Resource Partnerships (selling forests and mines to cronies). Nothing marks them before choosing and their order is shuffled. After enacting, "the fine print" reveals what they really did, which Sustainable Development Goals they undermine and how much reached the leader's pocket; the simulation, the chronicle and the lives-saved ledger show the damage. Corrupt choices add to a hidden personal fortune, and the bigger it grows, the likelier a "leaked bank records" scandal.
- **High-stakes reforms.** Alongside steady policies, the menu includes realistic big bets drawn from real policy debates: an IMF structural adjustment loan, removing fuel subsidies, a mega-dam, privatizing the state power company, nationalizing mines and oil, a special economic zone built on foreign loans, doubling the minimum wage, free universal primary education, redistributing large estates, a food export ban, a nuclear power plant and microloans for women. Each has a large potential payoff, a 25 to 40 percent chance of a serious setback, and effects that arrive over several turns. They are offered only where they fit the country's data: nationalization needs meaningful resource rents (NY.GDP.TOTL.RT.ZS), nuclear power is not offered to low-income economies, and an IMF program becomes likelier as the treasury empties.
- **Impact ledger.** Indicator gaps become people: infant lives saved (difference in infant mortality × births), people with electricity (difference in access × population) and extra CO2 emitted (difference per person × population). During play you are compared with staying the course every turn; at the end, with real history. Births come from the real crude birth rate (SP.DYN.CBRT.IN). These are simulated estimates.
- **SDG tags.** Every policy is tagged with the UN Sustainable Development Goals it mainly targets.

## How the game works

1. **Setup.** Choose a country on the map or by search, a start year, a mission (Balanced Development, Economic Growth, Quality of Life, Green Development) and a difficulty. The world seed that drives dice and events is chosen automatically, so any game can be replayed exactly. Start years are enabled only when the World Bank has enough real data at the start and 20 years later.
2. **National briefing.** The real starting conditions, fetched live. Click any statistic to see its indicator code, requested year and observation year.
3. **Ten turns of two years.** Each turn has five phases:
   1. *World briefing*: global and regional conditions from World Bank aggregates, plus your simulated domestic situation.
   2. *National problem*: chosen from your country's current simulated weaknesses.
   3. *Decision*: the four policies most relevant to your country (each problem has a pool of 5 to 7 candidates, ranked by the country's own data such as farming share, electricity access, income level and emissions, with a "why here" reason), plus "Stay the Course". Each shows cost, qualitative hints (`+++` to `---`) and risk, but not exact results.
   4. *Consequences*: immediate effects and delayed effects scheduled for later turns.
   5. *World reaction and chapter*: an event whose likelihood depends on real world data and your economy's structure; the economy runs for two years; a fictional political development follows (an election every four years, whose result depends on public satisfaction, or protests, strikes, coalition demands, scandals and popular reforms). The chapter then tells your story and, beside it, **what actually happened** in the real country over the same two years, from World Bank data, with a verdict on where you are ahead or behind.
4. **Final reveal.** Your simulated timeline against World Bank history, charts, the History Delta by category, and your biggest success and tradeoff.

Game mechanics (treasury, political capital, public satisfaction) are shown in a separate purple bar marked "not World Bank data".

## Run the game on your computer

The game runs locally in your web browser. It works on macOS, Windows and Linux and needs no accounts or API keys.

### 1. Install the prerequisites

- **Node.js 20.9 or newer** (includes npm). Download the LTS version from https://nodejs.org. Check it in a terminal with `node --version`.
- **Git**, to download the code (https://git-scm.com). Or download the ZIP instead (see step 2).
- An internet connection. The game loads live data from the World Bank Indicators API.

### 2. Download the code

With Git:

```sh
git clone https://github.com/LordBusiness011124/Carolina-Data-Challenge-2026.git
cd Carolina-Data-Challenge-2026
git checkout Game-remodeling
```

Without Git: open https://github.com/LordBusiness011124/Carolina-Data-Challenge-2026/tree/Game-remodeling, click **Code**, then **Download ZIP**, unzip it and open a terminal in the unzipped folder.

### 3. Install and start

```sh
npm install
npm run dev
```

`npm install` downloads the game's libraries and only needs to run once. When the terminal shows `Ready`, open **http://localhost:3000** in your browser.

To stop the game, press `Ctrl+C` in the terminal. To play again later, open a terminal in the same folder and run `npm run dev`.

### Faster version (optional)

For the smoothest play, for example in a presentation, build an optimized version once and run it:

```sh
npm run build
npm start
```

Then open http://localhost:3000 as before.

### Troubleshooting

- **Port 3000 is already in use:** run `npm run dev -- -p 3001` and open http://localhost:3001.
- **The first country takes a few seconds to load:** the game is downloading that country's history from the World Bank. Later loads come from a local cache in the `.cache` folder.
- **"Historical data could not be loaded":** check your internet connection and press Retry. The game never substitutes made-up data.
- **`npm` is not recognized:** Node.js is not installed or the terminal was opened before installing it. Install Node.js, then open a new terminal.

## World Bank Indicators API usage

- API v2 at `https://api.worldbank.org/v2/`, no key, `format=json` on every request.
- Date ranges (`date=1980:2025`) and `per_page=1000`, with all pages fetched when `pages > 1`.
- Indicators from the WDI source are batched with semicolons and `source=2`, for example `country/VNM/indicator/SP.POP.TOTL;SP.DYN.LE00.IN?format=json&date=1990:2010&source=2`. One request fetches a country's full history; one fetches world aggregates; one fetches the regional growth aggregate.
- The country list comes from `country?format=json&per_page=400`; aggregates (region id `NA`) are excluded, and each country's region id doubles as its regional aggregate code.
- Rivals are batched across countries and indicators in one request, for example `country/THA;IDN;MYS;.../indicator/SP.DYN.LE00.IN;NY.GDP.PCAP.KD;SP.DYN.IMRT.IN;EG.ELC.ACCS.ZS?source=2`, paginated as needed. The player's own country is never included.
- Responses are validated with Zod, null values are dropped (never zero), and results are cached for 7 days in memory and in `.cache/worldbank/`.
- Requests have a 25 second timeout and three attempts with backoff. A failed request shows a retry message; no substitute data is shown.
- The **Data source** page (`/data`) runs a live request for any game indicator and shows the URL, observation count, years without data, the values, and a log of this server's recent API requests.

Documentation: [About the Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation) · [API basic call structures](https://datahelpdesk.worldbank.org/knowledgebase/articles/898581)

## Architecture

```
src/lib/worldbank/indicators.ts   Indicator registry (codes, units, direction, scoring scale)
src/lib/worldbank/normalize.ts    Zod schemas; raw API JSON -> Observation objects
src/lib/worldbank/observations.ts Nearest-observation rule and past-only trend helpers
src/lib/worldbank/client.ts       HTTP client: pagination, batching, timeout, retry, cache, request log (server only)
src/lib/worldbank/package.ts      Start-year coverage checks, start package, reveal package (pure)
src/lib/worldbank/service.ts      getCountryHistory, getWorldContext, getStartPackage, getRevealPackage
src/lib/game/rules.ts             All tunable constants, policies, problems, events, objectives
src/lib/game/simulation.ts        Deterministic engine: createGame, applyDecision, worldReaction, nextTurn
src/lib/game/scoring.ts           Category scores, objective score, History Delta
src/lib/game/rng.ts               Seeded random numbers
src/lib/game/relevance.ts         Ranks each problem's candidate policies for the country, with reasons
src/lib/game/politics.ts          Fictional political storyline (elections, protests, scandals)
src/lib/game/story.ts             Chronicle: your story and what actually happened, per turn
src/lib/game/impact.ts            Impact ledger: lives saved, people with power, extra CO2
src/lib/worldbank/rivals.ts       Development index and regional standings
src/components/WorldMap.tsx       SVG world map (world-atlas shapes, d3-geo projection)
src/app/api/*                     countries, setup, start, rivals, reveal, verify, requests route handlers
src/components/*                  Landing, setup, briefing, dashboard, reveal, methodology modal, data page
tests/                            Vitest suites, synthetic fixtures, calibration and browser playthrough scripts
```

Stack: Next.js 16 (App Router), TypeScript, React 19, Tailwind CSS 4, Recharts, Zod, Vitest. The simulation runs in the browser from pure functions; World Bank requests run in server route handlers. No LLM is used, and the game needs no API keys.

## Simulation methodology

Each simulated year:

```
new value = previous simulated value
          + the country's trend in the 8 years before the start (past data only, partly persisting)
          + effects of this turn's policy
          + delayed effects of earlier policies
          + this turn's world event
          + interactions (trade exposure scales world shocks, growth feeds jobs, income drives emissions)
          then clamped to plausible bounds
```

Key rules (all constants in `src/lib/game/rules.ts`):

- **GDP growth** mean-reverts to the country's pre-start average (clamped 1–7%), moves with the gap between real world growth and its pre-start average times trade exposure, and takes policy and event modifiers. Low treasury or low satisfaction reduces growth. Spending on policies drags growth slightly.
- **GDP per capita** grows with GDP growth minus population growth.
- **Life expectancy** and **urbanization** follow past trends that slow as they approach ceilings. **Infant mortality** declines by a percentage based on its past trend.
- **Electricity access** closes a share of the remaining gap each year. **Internet use** follows an adoption curve.
- **FDI** and **trade** move toward their pre-start averages plus policy and event shifts.
- **CO2 per person** grows with per-capita income, faster while emissions are low, and less as renewables rise. **Renewable share** follows part of its past trend and drifts down while it is high, as traditional biomass gives way to modern fuels.
- **Unemployment** falls when growth beats its anchor and rises when it lags.
- **Policies** add modifiers now and schedule delayed ones, for example "Universal Schooling Drive" raises enrollment now and productivity two turns later. Effects are scaled by 0.5 because real history already includes ordinary government action, shrink by 40% each time a policy is repeated, and vary by a seeded execution factor between 0.7 and 1.2. Some policies carry a seeded risk of a setback.
- **World events** are chosen by seeded weighted draw. Weights come from real world data (a fall in world GDP growth makes a slowdown likely; rising world trade makes trade expansion likely) and from the country's structure (trade, FDI and agriculture shares). Severity also scales with exposure. Events describe data-derived conditions and never claim named historical events.
- **Seeds**: every random draw is keyed by seed, turn and purpose, so the same seed and the same decisions produce the same game.

**Calibration.** `tests/calibration.ts` plays hundreds of random games per country against real data. Policy strength was tuned so that active play beats staying the course every turn by about 4 to 8 points of the 0–100 mission score. How hard it is to beat history depends on what really happened: in the latest balance run (200 random games each), random play beat history in 24% of Vietnam games (1995–2015), 99% of Ghana games (1991–2011) and none of the Brazil games (1990–2010, a period of strong real progress). Choosing options that fit the country improves these odds.

## Scoring

- Indicator score = `50 + 50 × tanh(change ÷ scale)`, so 50 means no change from the start year.
- Change is `ln(end ÷ start)` for GDP per capita, infant mortality and CO2; the share of the remaining gap closed for electricity; distance from 100% for school enrollment (gross enrollment above 100% reflects over-age and repeating pupils); and the plain difference for the rest. Direction is flipped where lower is better.
- Categories: **Economy** (GDP per capita, unemployment, FDI), **Health** (life expectancy, infant mortality), **Education** (enrollment, female labor participation), **Infrastructure** (electricity, internet), **Sustainability** (CO2 per person, renewable share). Each averages the indicators that have data.
- The objective weights the categories (Balanced 20% each; Growth weights Economy 50%; Quality of Life weights Health 40% and Education 30%; Green weights Sustainability 40%).
- **History Delta** scores the real end values from the same start with the same formulas, using only indicators with a real end-year observation on both sides. Biggest success and tradeoff are the indicators with the largest positive and negative score gaps.

Scores measure progress against the chosen objective only. They make no claim that one country or political approach is objectively better.

## Historical versus simulated values

- Values labeled **World Bank** (amber) are real observations from the API, with their code and observation year.
- Values labeled **Simulated** (blue) come from the game model. They are never World Bank observations, and the World Bank does not endorse them.
- During play the browser receives only the country's data up to the start year (starting values, past trends) plus global and regional aggregates. After each turn, `/api/history` returns real values only up to the year just played, so real history unfolds one chapter at a time and later years stay hidden until they are reached.
- The political storyline is fictional and labeled as such. The "what actually happened" text states only what the World Bank data shows and never invents real events.
- Source and simulated data are separate types (`ResolvedValue` versus `SimulatedMetrics`).

## Indicators

| Game indicator | World Bank code |
| --- | --- |
| Population | SP.POP.TOTL |
| Population growth | SP.POP.GROW |
| GDP per capita (constant 2015 US$) | NY.GDP.PCAP.KD |
| GDP growth | NY.GDP.MKTP.KD.ZG |
| Urban population | SP.URB.TOTL.IN.ZS |
| Life expectancy | SP.DYN.LE00.IN |
| Infant mortality | SP.DYN.IMRT.IN |
| Electricity access | EG.ELC.ACCS.ZS |
| Internet users | IT.NET.USER.ZS |
| FDI net inflows | BX.KLT.DINV.WD.GD.ZS |
| Trade | NE.TRD.GNFS.ZS |
| CO2 per person | EN.GHG.CO2.PC.CE.AR5 |
| Renewable energy share | EG.FEC.RNEW.ZS |
| Unemployment | SL.UEM.TOTL.ZS |
| Female labor participation | SL.TLF.CACT.FE.ZS |
| School enrollment | first with coverage of SE.PRM.ENRR, SE.PRM.NENR, SE.SEC.ENRR, SE.TER.ENRR |
| Agriculture share (structure) | NV.AGR.TOTL.ZS |
| Industry share (structure) | NV.IND.TOTL.ZS |
| Natural resource rents (structure) | NY.GDP.TOTL.RT.ZS |
| Birth rate (impact ledger) | SP.DYN.CBRT.IN |

World context uses the `WLD` aggregate for GDP growth, trade, FDI, internet use and natural resource rents (NY.GDP.TOTL.RT.ZS), and the regional aggregate (EAS, LCN or SSF) for GDP growth.

Verified against the API: `EN.ATM.CO2E.PC` from the original candidate list has been removed from the API, so the game uses `EN.GHG.CO2.PC.CE.AR5`. Water and sanitation access start in 2000 and Brazil lacks 1990s enrollment data, so they are not used for 1990s starts.

## Missing data

A start year needs real observations of population, population growth, GDP per capita, GDP growth, life expectancy, infant mortality and electricity access at the start, and at least one real observation in every score category at both ends. Other indicators are simulated when available and skipped when not, and national problems that depend on a missing indicator are never posed. With current data, 187 of 217 countries are playable; the rest are mostly small territories or countries whose data begins too late (for example South Sudan and Kosovo).

For each value:

1. An observation in the requested year.
2. Otherwise the nearest real observation within 2 years, preferring the earlier year on a tie, flagged as nearest-year in the interface.
3. Otherwise the indicator is left out of that calculation.
4. School enrollment falls back through approved alternative indicators.

Missing data is never treated as zero. A start year is disabled when a required indicator lacks a real observation at the start or a score category lacks one 20 years later. For example, Vietnam's earliest playable year is 1995 because its electricity data starts in 1997.

## Tests

```sh
npm test            # unit tests: normalization, missing values, nearest observation, policies,
                    # delayed effects, events, scoring, History Delta, seeded reproducibility, no future leak
npm run lint
npm run build
```

With the dev server running:

```sh
GAME_URL=http://localhost:3000 npx vitest run --config vitest.calibration.config.ts --disableConsoleIntercept
BASE_URL=http://localhost:3000 npm run test:e2e -- GHA   # full browser playthrough, needs Google Chrome
```

Test fixtures in `tests/fixtures` are synthetic and are never used by the application.

## Competition requirement compliance

- Retrieves real data programmatically from the World Bank Indicators API v2 with `format=json`, date ranges, large `per_page`, pagination and batched indicators.
- No historical indicator values are hard-coded in the application.
- Attribution is shown on every screen: "Historical development data provided by the World Bank Indicators API."
- Indicator codes and observation years are visible when a statistic is inspected, and on the reveal.
- The `/data` page demonstrates live API requests.

## Limitations

- Policy effects are simplified, explainable game rules, not estimated causal effects.
- Baselines extend each country's pre-start trends, so they cannot foresee structural breaks that happened in reality.
- GDP per capita is in constant 2015 US dollars; the game does not model inflation or exchange rates.
- World events are data-informed categories rather than named historical events.
- The development index on the board is a simple game index, not the UN Human Development Index.
- Impact ledger figures are simulated estimates built from simplified formulas.
- The map uses 1:110m Natural Earth shapes; small countries appear as capital-city markers.

## Future improvements

- Historical analog engine (similar country-years by normalized indicators).
- Multiplayer: several players take different countries in the same region and year.
- Optional AI narration and freeform policies layered on top of the deterministic engine.
- More countries and eras, daily challenge seeds, shareable result cards, save and load.
