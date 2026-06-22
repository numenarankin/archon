"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2Icon, EyeIcon, EyeOffIcon } from "lucide-react";
import { Particles } from "@/components/ui/particles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { formatUsPhone } from "@/lib/format/phone";

interface AcceptInviteProps {
  /** Raw invite token from the URL; re-validated server-side on submit. */
  token: string;
  /** Invited email — fixed by the invite, shown read-only. */
  email: string;
}

/**
 * Member onboarding: set a password and provide first/last name + phone. On
 * submit the accept route creates the account and links the membership; we then
 * establish the browser session and land in the app. Members skip the company
 * onboarding entirely (the org already has it) and never touch billing.
 */
export function AcceptInvite({ token, email }: AcceptInviteProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, firstName, lastName, phone }),
      });
      const result = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        email?: string;
        error?: string;
      };
      if (!res.ok || !result.ok) {
        throw new Error(result.error ?? "Could not accept the invite.");
      }
      // Account exists now — establish the browser session and land in the app.
      const supabase = getSupabaseBrowser();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: result.email ?? email,
        password,
      });
      if (signInErr) throw signInErr;
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative w-full md:h-screen md:overflow-hidden">
      <Particles className="absolute inset-0" color="#666666" ease={20} quantity={120} />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-8">
        <div className="mx-auto space-y-6 sm:w-sm">
          <div className="flex items-center gap-2.5">
            <Image
              src="/wildcat-logo.png"
              alt="Archon logo"
              width={60}
              height={60}
              className="size-[60px]"
            />
            <span className="text-3xl font-bold tracking-tight text-foreground">
              Archon
            </span>
          </div>
          <div className="flex flex-col space-y-1">
            <h1 className="font-bold text-2xl tracking-wide">Join your team</h1>
            <p className="text-base text-muted-foreground">
              Finish setting up your account to get started.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Email</span>
              <Input type="email" value={email} readOnly disabled className="h-11" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">First name</span>
                <Input
                  required
                  autoFocus
                  className="h-11"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Last name</span>
                <Input
                  required
                  className="h-11"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Phone</span>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className="h-11"
                value={phone}
                onChange={(e) => setPhone(formatUsPhone(e.target.value))}
                placeholder="(555) 123-4567"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Password</span>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="h-11 pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
            </label>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading && (
                <Loader2Icon data-icon="inline-start" className="animate-spin" />
              )}
              Join team
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
