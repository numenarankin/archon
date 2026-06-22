/**
 * Private Supabase Storage bucket holding the original files behind accounting
 * upload batches. Shared by the server (admin reads/writes, signed-URL minting)
 * and the browser (direct-to-storage upload via a signed upload URL), so it
 * lives in a plain module rather than the `"use server"` actions file.
 */
export const ACCOUNTING_UPLOAD_BUCKET = "accounting-uploads";

/**
 * Validates that a client-supplied storage key belongs to the given org. Keys
 * are namespaced `${orgId}/<uuid>`; rejecting anything outside the caller's
 * prefix stops one org from referencing (extracting, claiming, or deleting)
 * another org's uploaded bytes via a forged key.
 */
export function isOwnedStorageKey(key: string, orgId: string): boolean {
  return key.startsWith(`${orgId}/`);
}
