import { getConversations } from "@/lib/ai/conversations";
import { ArchonWorkspace } from "@/components/ai/archon-workspace";
import { requirePermission } from "@/lib/auth/permissions";

export default async function ArchonPage() {
  await requirePermission("use_ai");
  const conversations = await getConversations();

  return <ArchonWorkspace initialConversations={conversations} />;
}
