import { recentRequests } from "@/lib/worldbank/client";

export async function GET() {
  return Response.json({ requests: recentRequests() });
}
