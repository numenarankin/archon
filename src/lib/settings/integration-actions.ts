"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Save/disconnect Google Workspace credentials from the Settings UI. Admin-only
 * (these are secrets). Writes go through the service-role client because the
 * `integration_settings` table is RLS-locked — see `./integrations`.
 */

export interface SaveGoogleWorkspaceInput {
  clientId: string;
  userEmail: string;
  /**
   * Secrets. An empty string means "leave the stored value unchanged" so the
   * UI can show a masked placeholder without round-tripping the secret. A
   * non-empty value overwrites.
   */
  clientSecret: string;
  refreshToken: string;
}

function refreshConsumers() {
  revalidatePath("/settings");
  revalidatePath("/email");
  revalidatePath("/calendar");
}

export async function saveGoogleWorkspaceSettings(
  input: SaveGoogleWorkspaceInput
): Promise<void> {
  await requireAdmin();
  const user = await getSessionUser();
  if (!user) throw new Error("saveGoogleWorkspaceSettings: not signed in");

  const update: Record<string, string | null> = {
    owner_id: user.id,
    google_client_id: input.clientId.trim() || null,
    google_user_email: input.userEmail.trim() || null,
  };
  // Only overwrite secrets when a new value was actually entered.
  if (input.clientSecret.trim()) {
    update.google_client_secret = input.clientSecret.trim();
  }
  if (input.refreshToken.trim()) {
    update.google_refresh_token = input.refreshToken.trim();
  }

  const { error } = await getSupabaseAdmin()
    .from("integration_settings")
    .upsert(update, { onConflict: "owner_id" });
  if (error) throw new Error(`saveGoogleWorkspaceSettings: ${error.message}`);

  refreshConsumers();
}

/** Clear all stored Google Workspace credentials. */
export async function disconnectGoogleWorkspace(): Promise<void> {
  await requireAdmin();
  const user = await getSessionUser();
  if (!user) throw new Error("disconnectGoogleWorkspace: not signed in");
  const { error } = await getSupabaseAdmin()
    .from("integration_settings")
    .upsert(
      {
        owner_id: user.id,
        google_client_id: null,
        google_client_secret: null,
        google_refresh_token: null,
        google_user_email: null,
      },
      { onConflict: "owner_id" }
    );
  if (error) throw new Error(`disconnectGoogleWorkspace: ${error.message}`);
  refreshConsumers();
}
