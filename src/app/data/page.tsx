import type { Metadata } from "next";
import DataExplorer from "@/components/DataExplorer";

export const metadata: Metadata = { title: "Data source · Humanity's Next Move" };

export default function DataPage() {
  return <DataExplorer />;
}
