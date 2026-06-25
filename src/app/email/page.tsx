import { getMailbox } from "@/lib/email/mailbox-data";
import { EmailApp } from "@/components/email/email-app";
import { requirePermission } from "@/lib/auth/permissions";

export default async function EmailPage() {
  await requirePermission("view_email");
  const { messages, live } = await getMailbox();
  return <EmailApp initialMessages={messages} live={live} />;
}
