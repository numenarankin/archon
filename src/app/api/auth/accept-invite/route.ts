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
 * Accept a workspace invite. The invite token is re-validated entirely
 * server-side (hash match + not expired + not already accepted), then:
 *   1. The auth account is created for the invited email (email pre-confirmed,
 *      same as every other account).
 *   2. A `workspace_members` row is inserted into the inviting workspace with the
 *      invited role + permissions, and the member's name/email.
 *   3. The invite is consumed (accepted_at stamped, hash cleared) so it can't be
 *      replayed, and the new user's agent context + profile are seeded.
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
  const { data: invite, error: lookupErr } = await admin
    .from("workspace_invites")
    .select("id, workspace_id, email, role, permissions, expires_at, accepted_at")
    .eq("invite_token_hash", hashInviteToken(token))
    .maybeSingle();
  if (lookupErr) {
    console.error("accept-invite lookup failed", lookupErr);
    return Response.json(
      { ok: false, error: "Could not validate your invite. Please try again." },
      { status: 500 }
    );
  }
  if (!invite) {
    return Response.json(
      { ok: false, error: "This invite link is invalid or has already been used." },
      { status: 400 }
    );
  }
  const row = invite as {
    id: string;
    workspace_id: string;
    email: string;
    role: "admin" | "member";
    permissions: string[] | null;
    expires_at: string | null;
    accepted_at: string | null;
  };
  if (row.accepted_at) {
    return Response.json(
      { ok: false, error: "This invite has already been accepted. Sign in instead." },
      { status: 409 }
    );
  }
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) {
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

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  // Add the new user to the inviting workspace as a member.
  const { error: memberErr } = await admin.from("workspace_members").insert({
    workspace_id: row.workspace_id,
    user_id: created.user.id,
    role: row.role,
    name: fullName,
    email: row.email,
    permissions: row.permissions ?? [],
  });
  if (memberErr) {
    // Roll the account back so the invite can be retried cleanly.
    console.error("accept-invite member insert failed; deleting orphaned user", memberErr);
    await admin.auth.admin.deleteUser(created.user.id).catch((delErr) => {
      console.error("orphan cleanup failed", delErr);
    });
    return Response.json(
      { ok: false, error: "Could not finish joining. Please try again." },
      { status: 500 }
    );
  }

  // Consume the invite (single-use). Guard on the token hash again so two
  // concurrent accepts can't both win.
  const { error: consumeErr } = await admin
    .from("workspace_invites")
    .update({ accepted_at: new Date().toISOString(), invite_token_hash: "" })
    .eq("id", row.id)
    .eq("invite_token_hash", hashInviteToken(token));
  if (consumeErr) {
    console.error("accept-invite token consume failed", consumeErr);
  }

  // Seed the new member's own agent context docs (their personalized Archon).
  const { error: seedErr } = await admin.rpc("seed_agent_context", {
    p_owner: created.user.id,
  });
  if (seedErr) console.error("accept-invite seed_agent_context failed", seedErr);

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
