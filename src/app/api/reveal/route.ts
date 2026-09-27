import { getRevealPackage } from "@/lib/worldbank/service";

// Real history for the final reveal. The client requests this only after the last turn.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    return Response.json(await getRevealPackage(params.get("country") ?? "", Number(params.get("year")), params.get("edu") ?? "SE.PRM.ENRR"));
  } catch (error) {
    return Response.json({ error: "Historical data could not be loaded from the World Bank. Please retry.", detail: String(error) }, { status: 502 });
  }
}
