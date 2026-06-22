import { getMailbox } from "@/lib/email/mailbox-data";
import { EmailApp } from "@/components/email/email-app";

export default async function EmailPage() {
  const { messages, live } = await getMailbox();
  return <EmailApp initialMessages={messages} live={live} />;
}
