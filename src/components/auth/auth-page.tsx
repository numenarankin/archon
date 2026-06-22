"use client";

import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { Particles } from "@/components/ui/particles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowser } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

/**
 * Where to land after sign-in: the `next` path the proxy stashed when it
 * bounced an unauthenticated request here, or home. Validated to a same-origin
 * relative path to avoid an open-redirect.
 */
function safeNext(): string {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//") && next !== "/auth") {
    return next;
  }
  return "/";
}

interface AuthPageProps {
  /**
   * Which view to show first. A `/auth?mode=signup` link (e.g. "Get started")
   * resolves to "signup"; defaults to sign-in. Read on the server so it's
   * correct on the first render (a `window`-based default would SSR as
   * "signin" and not recompute on hydration).
   */
  initialMode?: Mode;
}

export function AuthPage({ initialMode }: AuthPageProps = {}) {
  const [mode, setMode] = useState<Mode>(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Surface a confirmation failure bounced back from /auth/callback (?error=…).
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("error");
    if (e) setError(e);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Hard navigation so the fresh session cookie is sent on the next
        // request and the proxy lets us through (a soft push can race the
        // cookie and bounce back to /auth).
        window.location.assign(safeNext());
        return;
      } else {
        // Standard Supabase sign-up: create the account and let Supabase send
        // the confirmation link. The link lands on /auth/callback, which
        // establishes the session. (If the project has email confirmation
        // disabled, signUp returns a session immediately and we go straight in.)
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (data.session) {
          window.location.assign(safeNext());
          return;
        }
        setNotice(
          "Check your email for a confirmation link to finish creating your account.",
        );
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const isSignIn = mode === "signin";

  return (
    <div className="relative w-full md:h-screen md:overflow-hidden">
      <Particles
        className="absolute inset-0"
        color="#666666"
        ease={20}
        quantity={120}
      />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-8">
        <div className="mx-auto space-y-6 sm:w-sm">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-10 text-foreground" />
            <span className="text-3xl font-bold tracking-tight text-foreground">
              Archon
            </span>
          </div>
          <div className="flex flex-col space-y-1">
            <h1 className="font-bold text-2xl tracking-wide">
              {isSignIn ? "Welcome back" : "Join now"}
            </h1>
            <p className="text-base text-muted-foreground">
              {isSignIn
                ? "Sign in to your Archon account."
                : "Create your Archon account."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Email</span>
              <Input
                type="email"
                autoComplete="email"
                required
                autoFocus
                className="h-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Password</span>
              <Input
                type="password"
                autoComplete={isSignIn ? "current-password" : "new-password"}
                required
                minLength={6}
                className="h-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                {notice}
              </p>
            )}

            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
              {isSignIn ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground">
            {isSignIn ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setMode(isSignIn ? "signup" : "signin");
                setError(null);
                setNotice(null);
              }}
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              {isSignIn ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
