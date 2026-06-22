import { lookupInvite } from "@/lib/auth/invite-data";
import { AcceptInvite } from "@/components/auth/accept-invite";

const ERRORS: Record<string, string> = {
  invalid: "This invite link is invalid or has already been used.",
  accepted: "This invite has already been accepted. Try signing in instead.",
  expired: "This invite has expired. Ask your admin to send a new one.",
  unavailable: "We couldn't validate your invite right now. Please try again.",
};

/**
 * Member invite landing. Validates the token on the server, then shows the
 * accept form (pre-filled, read-only email) or a friendly error. The accept
 * route re-validates the token, so this page-load check is purely for UX.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await lookupInvite(token);

  if (!result.ok) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <div className="rounded-xl border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">Invite unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ERRORS[result.reason] ?? ERRORS.invalid}
          </p>
        </div>
      </div>
    );
  }

  return <AcceptInvite token={token} email={result.email} />;
}
