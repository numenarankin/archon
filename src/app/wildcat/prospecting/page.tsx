import { OperatorProspectingWorkspace } from "@/components/wildcat/operator-prospecting-workspace";
import { requirePermission } from "@/lib/auth/permissions";

export const metadata = {
  title: "Operator Prospecting",
  description: "Every RRC operator on the map, as a searchable table.",
};

export default async function WildcatProspectingPage() {
  await requirePermission("view_map");
  return <OperatorProspectingWorkspace />;
}
