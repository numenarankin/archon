import { requirePermission } from "@/lib/auth/permissions";
import { getStaffSupportThreads } from "@/lib/support/staff-data";
import { StaffSupportApp } from "@/components/support/staff-support-app";

/**
 * Staff support inbox: the platform side of the two-sided support chat. Threads
 * live in the webapp's database and are reached here with its service-role key.
 * Gated behind `view_email` (staff comms) until a dedicated capability exists.
 */
export default async function SupportPage() {
  await requirePermission("view_email");
  const threads = await getStaffSupportThreads();
  const configured =
    !!process.env.WEBAPP_SUPABASE_URL && !!process.env.WEBAPP_SUPABASE_SECRET_KEY;
  return <StaffSupportApp initialThreads={threads} configured={configured} />;
}
