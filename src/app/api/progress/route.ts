import { getIndicators } from "@/lib/worldbank/client";
import { INDICATORS } from "@/lib/worldbank/indicators";
import { HISTORY_RANGE } from "@/lib/worldbank/service";

// World progress since 1990 (World Bank "WLD" aggregate), shown on the landing page as evidence
// that large-scale change is possible. Values come live from the API, never hard-coded.
const IDS = ["infantMortality", "lifeExpectancy", "electricity"] as const;

export async function GET() {
  try {
    const observations = await getIndicators("WLD", IDS.map((id) => INDICATORS[id].code), 1990, HISTORY_RANGE.end);
    const progress = IDS.map((id) => {
      const points = observations.filter((o) => o.indicator === INDICATORS[id].code).sort((a, b) => a.year - b.year);
      if (points.length < 2) return null;
      const first = points[0], last = points[points.length - 1];
      return { id, code: INDICATORS[id].code, name: INDICATORS[id].shortName, from: { year: first.year, value: first.value }, to: { year: last.year, value: last.value } };
    }).filter(Boolean);
    return Response.json({ progress });
  } catch (error) {
    return Response.json({ error: "World progress data could not be loaded.", detail: String(error) }, { status: 502 });
  }
}
