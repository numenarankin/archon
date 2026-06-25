/**
 * Private Supabase Storage bucket holding the original files behind budget
 * upload batches. Shared by the server (admin reads/writes, signed-URL minting)
 * and the browser (direct-to-storage upload via a signed upload URL), so it
 * lives in a plain module rather than the `"use server"` actions file.
 */
export const BUDGET_UPLOAD_BUCKET = "budget-uploads";
