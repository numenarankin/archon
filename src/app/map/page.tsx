import { WellsMap } from "@/components/map/wells-map";
import { requirePermission } from "@/lib/auth/permissions";

export const metadata = {
  title: "Well Map",
  description: "Every Texas RRC well, clustered, with operator detail on click.",
};

// The map fills the full-bleed content area (see app-main.tsx).
export default async function MapPage() {
  await requirePermission("view_map");
  return <WellsMap />;
}
