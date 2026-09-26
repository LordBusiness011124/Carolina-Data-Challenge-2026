import { getRevealPackage } from "@/lib/worldbank/service";

// Real history for the turns already played: turn years 0..upTo only, so later years stay hidden.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const upTo = Math.max(0, Math.min(10, Math.floor(Number(params.get("upTo") ?? 0))));
  try {
    const pkg = await getRevealPackage(params.get("country") ?? "", Number(params.get("year")), params.get("edu") ?? "SE.PRM.ENRR");
    const history = Object.fromEntries(Object.entries(pkg.history).map(([id, values]) => [id, values.slice(0, upTo + 1)]));
    return Response.json({ turnYears: pkg.turnYears.slice(0, upTo + 1), history });
  } catch (error) {
    return Response.json({ error: "Historical data could not be loaded from the World Bank. Please retry.", detail: String(error) }, { status: 502 });
  }
}
