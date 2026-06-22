import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Email-confirmation landing. Supabase's confirmation link redirects here after
 * the user clicks it. We complete the sign-in by establishing the session
 * cookie, then send them into the app.
 *
 * Handles both link shapes Supabase can send:
 *  - PKCE `?code=...`         → exchangeCodeForSession (the default for the
 *                               cookie/SSR client used here)
 *  - OTP `?token_hash=&type=` → verifyOtp (if the project's email template uses
 *                               the {{ .TokenHash }} form)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";
  const redirectTo = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await getSupabaseServer();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${redirectTo}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${redirectTo}`);
  }

  return NextResponse.redirect(
    `${origin}/auth?error=${encodeURIComponent("Could not confirm your account. The link may have expired — try signing in.")}`
  );
}
