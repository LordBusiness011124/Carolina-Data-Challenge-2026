import { getRivals } from "@/lib/worldbank/service";

// Real data for the other countries in the player's region. Excludes the player's own country.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    return Response.json(await getRivals(params.get("country") ?? "", Number(params.get("year"))));
  } catch (error) {
    return Response.json({ error: "Regional data could not be loaded from the World Bank. Please retry.", detail: String(error) }, { status: 502 });
  }
}
