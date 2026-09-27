import { getStartPackage } from "@/lib/worldbank/service";

// Returns starting conditions, past-only trends and world context. Never the country's future values.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const year = Number(params.get("year"));
  try {
    return Response.json(await getStartPackage(params.get("country") ?? "", year));
  } catch (error) {
    return Response.json({ error: "Historical data could not be loaded from the World Bank. Please retry.", detail: String(error) }, { status: 502 });
  }
}
