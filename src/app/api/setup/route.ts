import { getSetupInfo } from "@/lib/worldbank/service";

export async function GET(request: Request) {
  const country = new URL(request.url).searchParams.get("country") ?? "";
  try {
    return Response.json(await getSetupInfo(country));
  } catch (error) {
    return Response.json({ error: "Historical data could not be loaded from the World Bank. Please retry.", detail: String(error) }, { status: 502 });
  }
}
