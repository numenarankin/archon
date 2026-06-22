import { WellsMap } from "@/components/map/wells-map";

export const metadata = {
  title: "Well Map",
  description: "Every Texas RRC well, clustered, with operator detail on click.",
};

// The map fills the full-bleed content area (see app-main.tsx).
export default function MapPage() {
  return <WellsMap />;
}
