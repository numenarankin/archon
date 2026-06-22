import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hashInviteToken } from "@/lib/auth/invite";

interface AcceptRequest {
  token?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
}

/**
 * Accept a member invite. The invite token is re-validated entirely
 * server-side (hash match + not expired + not already accepted), then:
 *   1. The auth account is created for the invited email (email pre-confirmed,
 *      same as every other account).
 *   2. The existing `org_members` row is linked to the new auth user, marked
 *      active, and stamped with the member's name + phone.
 *   3. The token is consumed (hash cleared) so the link can't be replayed.
 *
 * Returns the invited email so the client can establish a browser session.
 */
export async function POST(req: Request) {
  let body: AcceptRequest;
  try {
    body = (await req.json()) as AcceptRequest;
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const { token, password, firstName, lastName, phone } = body;
  if (
    typeof token !== "string" ||
    typeof password !== "string" ||
    typeof firstName !== "string" ||
    typeof lastName !== "string"
  ) {
    return Response.json(
      { ok: false, error: "Name, password, and a valid invite are required." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return Response.json(
      { ok: false, error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }
  if (!firstName.trim() || !lastName.trim()) {
    return Response.json(
      { ok: false, error: "First and last name are required." },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();

  // Validate the token: hash match, still pending, not expired.
  const { data: member, error: lookupErr } = await admin
    .from("org_members")
    .select("id, email, invite_expires_at, invite_accepted_at")
    .eq("invite_token_hash", hashInviteToken(token))
    .maybeSingle();
  if (lookupErr) {
    console.error("accept-invite lookup failed", lookupErr);
    return Response.json(
      { ok: false, error: "Could not validate your invite. Please try again." },
      { status: 500 }
    );
  }
  if (!member) {
    return Response.json(
      { ok: false, error: "This invite link is invalid or has already been used." },
      { status: 400 }
    );
  }
  const row = member as {
    id: string;
    email: string;
    invite_expires_at: string | null;
    invite_accepted_at: string | null;
  };
  if (row.invite_accepted_at) {
    return Response.json(
      { ok: false, error: "This invite has already been accepted. Sign in instead." },
      { status: 409 }
    );
  }
  if (row.invite_expires_at && Date.parse(row.invite_expires_at) < Date.now()) {
    return Response.json(
      { ok: false, error: "This invite has expired. Ask your admin to re-send it." },
      { status: 410 }
    );
  }

  // Create the account for the invited email.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: row.email,
    password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    const alreadyExists = /already.*regist|already.*exist|duplicate/i.test(
      createErr?.message ?? ""
    );
    return Response.json(
      {
        ok: false,
        error: alreadyExists
          ? "An account with this email already exists. Sign in instead."
          : "Could not create your account. Please try again.",
      },
      { status: alreadyExists ? 409 : 500 }
    );
  }

  // Link the membership and consume the token. Guard on the token hash again so
  // two concurrent accepts can't both win.
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const { error: linkErr } = await admin
    .from("org_members")
    .update({
      auth_user_id: created.user.id,
      status: "active",
      name: fullName,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: typeof phone === "string" ? phone.trim() : null,
      invite_accepted_at: new Date().toISOString(),
      invite_token_hash: null,
      invite_expires_at: null,
    })
    .eq("id", row.id)
    .eq("invite_token_hash", hashInviteToken(token));
  if (linkErr) {
    // Roll the account back so the invite can be retried cleanly.
    console.error("accept-invite link failed; deleting orphaned user", linkErr);
    await admin.auth.admin.deleteUser(created.user.id).catch((delErr) => {
      console.error("orphan cleanup failed", delErr);
    });
    return Response.json(
      { ok: false, error: "Could not finish joining. Please try again." },
      { status: 500 }
    );
  }

  // Seed the member's per-user profile so their name + phone show on Settings >
  // Profile. The membership row carries them for the roster, but `profile` is
  // the source of truth for the signed-in user's own profile view. Best-effort:
  // a failure here shouldn't undo a successful join.
  const { error: profileErr } = await admin.from("profile").upsert(
    {
      user_id: created.user.id,
      name: fullName,
      phone: typeof phone === "string" ? phone.trim() : null,
    },
    { onConflict: "user_id" }
  );
  if (profileErr) {
    console.error("accept-invite profile seed failed", profileErr);
  }

  return Response.json({ ok: true, email: row.email });
}
