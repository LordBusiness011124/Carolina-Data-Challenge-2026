import { listCountries } from "@/lib/worldbank/service";

// Every country from the World Bank country API (regional and income aggregates excluded).
export async function GET() {
  try {
    return Response.json({ countries: await listCountries() });
  } catch (error) {
    return Response.json({ error: "The country list could not be loaded from the World Bank. Please retry.", detail: String(error) }, { status: 502 });
  }
}
