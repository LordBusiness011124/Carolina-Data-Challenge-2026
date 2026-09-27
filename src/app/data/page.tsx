import type { Metadata } from "next";
import DataExplorer from "@/components/DataExplorer";

export const metadata: Metadata = { title: "Data source · Beat History" };

export default function DataPage() {
  return <DataExplorer />;
}
