"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, CheckIcon, CheckCircle2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  saveGoogleWorkspaceSettings,
  disconnectGoogleWorkspace,
} from "@/lib/settings/integration-actions";
import type { GoogleWorkspaceSettingsView } from "@/lib/settings/integrations";

export function IntegrationsSection({
  google,
}: {
  google: GoogleWorkspaceSettingsView;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <GoogleWorkspaceCard google={google} />
    </div>
  );
}

function GoogleWorkspaceCard({
  google,
}: {
  google: GoogleWorkspaceSettingsView;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [clientId, setClientId] = useState(google.clientId);
  const [userEmail, setUserEmail] = useState(google.userEmail);
  // Secrets start blank; a blank value on save means "leave unchanged".
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const connected =
    Boolean(clientId && google.hasClientSecret && google.hasRefreshToken) ||
    google.envFallback;

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveGoogleWorkspaceSettings({
          clientId,
          userEmail,
          clientSecret,
          refreshToken,
        });
        setClientSecret("");
        setRefreshToken("");
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  function disconnect() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await disconnectGoogleWorkspace();
        setClientId("");
        setUserEmail("");
        setClientSecret("");
        setRefreshToken("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to disconnect.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Google Workspace
          {connected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2Icon className="size-3.5" />
              Connected
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Connect Gmail and Google Calendar so the Email and Calendar pages read
          and send your real mail and events. Setup steps are in{" "}
          <code className="font-mono text-xs">docs/gmail.md</code> (authorize the
          gmail + calendar scopes).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {google.envFallback && (
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Currently using credentials from environment variables. Saving here
            stores them in the app and overrides the environment.
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Client ID</span>
          <Input
            className="h-9"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="…apps.googleusercontent.com"
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Client secret</span>
          <Input
            className="h-9"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={
              google.hasClientSecret ? "•••••••• (saved — leave blank to keep)" : "GOCSPX-…"
            }
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Refresh token</span>
          <Input
            className="h-9"
            type="password"
            value={refreshToken}
            onChange={(e) => setRefreshToken(e.target.value)}
            placeholder={
              google.hasRefreshToken ? "•••••••• (saved — leave blank to keep)" : "1//0g…"
            }
            autoComplete="off"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Mailbox email</span>
          <Input
            className="h-9"
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="you@yourcompany.com"
            autoComplete="off"
          />
        </label>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Save
          </Button>
          {connected && !google.envFallback && (
            <Button variant="ghost" onClick={disconnect} disabled={pending}>
              Disconnect
            </Button>
          )}
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {saved && !pending ? (
              <span className="inline-flex items-center gap-1.5">
                <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                Saved
              </span>
            ) : null}
          </span>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
