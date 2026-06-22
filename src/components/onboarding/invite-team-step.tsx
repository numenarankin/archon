"use client";

import { useState } from "react";
import { Loader2Icon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteMember } from "@/lib/settings/actions";

/**
 * Optional "invite your team" step in onboarding. Emails each teammate a secure
 * invite link (reusing the same tokenized invite action as Settings) and lists
 * who it was sent to. Permissions start empty and can be granted later from
 * Settings &gt; Organization.
 */
export function InviteTeamStep() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string[]>([]);

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    setError(null);
    setLoading(true);
    try {
      const { email: invited } = await inviteMember(trimmedName, normalized);
      setSent((prev) => [...prev, invited]);
      setName("");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">Invite your team (optional)</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We&apos;ll email teammates a secure link to join your workspace.
      </p>

      <form onSubmit={handleInvite} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          className="h-10"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
        />
        <Input
          type="email"
          className="h-10"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
        />
        <Button type="submit" variant="outline" className="h-10" disabled={loading}>
          {loading && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
          Invite
        </Button>
      </form>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {sent.length > 0 && (
        <ul className="mt-3 space-y-2">
          {sent.map((invited) => (
            <li
              key={invited}
              className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
            >
              <span className="truncate text-muted-foreground">{invited}</span>
              <span className="flex shrink-0 items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <CheckIcon className="size-3.5" />
                Invite sent
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
