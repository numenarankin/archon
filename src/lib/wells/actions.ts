"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";
import { embedFile } from "@/lib/ai/retrieval";
import { getOrCreateWellFolderId } from "@/lib/wells/well-folder";
import { DEFAULT_EQUIPMENT_LABELS } from "@/lib/wells/equipment-fields";
import { getSessionUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/settings/profile";
import type {
  EquipmentField,
  ProductionPoint,
  WellEquipment,
  WellFile,
} from "@/lib/wells/wells";
import type { RoyaltyOwner } from "@/lib/people/people";
import type { KBFileType } from "@/lib/kb/types";

const FILES_BUCKET = "files";

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tiff"];

/** Map a filename's extension to one of the allowed file types. */
function fileType(name: string): KBFileType {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "md" || ext === "markdown") return "md";
  if (IMAGE_EXTS.includes(ext)) return "image";
  return "doc";
}

export interface WellInput {
  name: string;
  formation: string;
  county: string;
  depth: number;
  perforations: string;
  dateDrilled: string;
  coordinates: string;
  /** Barrels of oil per inch of gauge (oil reading conversion). Defaults to 1. */
  oilBblPerInch?: number;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "well"
  );
}

function toRow(input: WellInput) {
  return {
    name: input.name,
    zone: input.formation || null,
    county: input.county || null,
    perforations: input.perforations || null,
    depth: Number.isFinite(input.depth) ? input.depth : null,
    date_drilled: input.dateDrilled || null,
    coordinates: input.coordinates || null,
    oil_bbl_per_inch:
      input.oilBblPerInch != null && Number.isFinite(input.oilBblPerInch)
        ? input.oilBblPerInch
        : 1,
  };
}

/** Create a well with a unique slug id; returns the new id. */
export async function createWell(input: WellInput): Promise<{ id: string }> {
  const sb = await getSupabaseServer();

  const base = slugify(input.name);
  const { data: existing, error: lookupError } = await sb
    .from("wells")
    .select("id")
    .like("id", `${base}%`);
  if (lookupError) throw new Error(`createWell: ${lookupError.message}`);

  const ids = new Set((existing ?? []).map((r) => r.id));
  let id = base;
  let n = 2;
  while (ids.has(id)) id = `${base}-${n++}`;

  const { error } = await sb.from("wells").insert({ id, ...toRow(input) });
  if (error) throw new Error(`createWell: ${error.message}`);

  revalidatePath("/wells");
  return { id };
}

/** Update a well's editable info. */
export async function updateWell(id: string, input: WellInput): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb.from("wells").update(toRow(input)).eq("id", id);
  if (error) throw new Error(`updateWell: ${error.message}`);

  revalidatePath(`/wells/${id}`);
  revalidatePath("/wells");
}

/**
 * Barrels of oil per gauge inch for a well (defaults to 1 / no conversion).
 * Oil readings are entered as gauge inches and converted to barrels at write
 * time, so the stored value is barrels and reads need no further conversion.
 */
async function wellOilRatio(
  sb: Awaited<ReturnType<typeof getSupabaseServer>>,
  wellId: string
): Promise<number> {
  const { data } = await sb
    .from("wells")
    .select("oil_bbl_per_inch")
    .eq("id", wellId)
    .maybeSingle();
  const ratio = data?.oil_bbl_per_inch;
  return ratio != null && Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

/**
 * Shared column mapping for a production reading. Oil fields arrive as gauge
 * inches and are converted to barrels here (× the well's bbl-per-inch ratio).
 */
function productionRow(point: ProductionPoint, ratio: number) {
  return {
    reading_date: point.date,
    reading_time: point.time || null,
    oil_production: point.oilProduction * ratio,
    oil_stock: point.oilStock * ratio,
    oil_sales: point.oilSales * ratio,
    gas_production: point.gasProduction,
    salt_water: point.saltWater,
  };
}

/** Record a daily production reading for a well; returns the new row id. */
export async function addProduction(
  wellId: string,
  point: ProductionPoint
): Promise<{ id: string }> {
  const sb = await getSupabaseServer();
  const ratio = await wellOilRatio(sb, wellId);
  const { data, error } = await sb
    .from("production_readings")
    .insert({ well_id: wellId, ...productionRow(point, ratio) })
    .select("id")
    .single();
  if (error) throw new Error(`addProduction: ${error.message}`);
  revalidatePath(`/wells/${wellId}`);
  return { id: data.id };
}

/** Update an existing production reading. */
export async function updateProduction(
  wellId: string,
  id: string,
  point: ProductionPoint
): Promise<void> {
  const sb = await getSupabaseServer();
  const ratio = await wellOilRatio(sb, wellId);
  const { error } = await sb
    .from("production_readings")
    .update(productionRow(point, ratio))
    .eq("id", id)
    .eq("well_id", wellId);
  if (error) throw new Error(`updateProduction: ${error.message}`);
  revalidatePath(`/wells/${wellId}`);
}

/** Delete a production reading. */
export async function deleteProduction(
  wellId: string,
  id: string
): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("production_readings")
    .delete()
    .eq("id", id)
    .eq("well_id", wellId);
  if (error) throw new Error(`deleteProduction: ${error.message}`);
  revalidatePath(`/wells/${wellId}`);
}

/**
 * Bulk-record production readings for a well — e.g. rows Archon extracted from an
 * uploaded production report. Idempotent: a reading whose (well, date, time)
 * already exists is skipped rather than overwritten (`ignoreDuplicates`), so
 * re-running over the same doc never duplicates or clobbers data. Returns how
 * many rows were added versus skipped as duplicates.
 */
export async function recordProductionReadings(
  wellId: string,
  points: ProductionPoint[]
): Promise<{ added: number; skipped: number }> {
  if (points.length === 0) return { added: 0, skipped: 0 };
  const sb = await getSupabaseServer();
  const ratio = await wellOilRatio(sb, wellId);
  const rows = points.map((point) => ({
    well_id: wellId,
    ...productionRow(point, ratio),
    // A daily report often has no clock time. Pin a blank time to midnight so
    // the (well, date, time) uniqueness key is stable — otherwise NULL != NULL
    // and re-importing the same report would insert duplicate rows.
    reading_time: point.time || "00:00",
  }));
  const { data, error } = await sb
    .from("production_readings")
    .upsert(rows, {
      onConflict: "well_id,reading_date,reading_time",
      ignoreDuplicates: true,
    })
    .select("id");
  if (error) throw new Error(`recordProductionReadings: ${error.message}`);
  const added = data?.length ?? 0;
  revalidatePath(`/wells/${wellId}`);
  return { added, skipped: points.length - added };
}

/** Shape a raw equipment row into a `WellEquipment`. */
function mapEquipment(r: {
  id: string;
  label: string | null;
  value: string | null;
  position: number | null;
}): WellEquipment {
  return {
    id: r.id,
    label: r.label ?? "",
    value: r.value ?? "",
    position: r.position ?? 0,
  };
}

const EQUIPMENT_COLS = "id, label, value, position";

/** Next free position for a well's equipment (so new rows append at the end). */
async function nextEquipmentPosition(
  sb: Awaited<ReturnType<typeof getSupabaseServer>>,
  wellId: string
): Promise<number> {
  const { data } = await sb
    .from("well_equipment")
    .select("position")
    .eq("well_id", wellId)
    .order("position", { ascending: false })
    .limit(1);
  return (data?.[0]?.position ?? -1) + 1;
}

/**
 * Ensure a well has its equipment sheet, returning the rows. If the well has no
 * equipment yet, seed the standard template (empty values) so the user lands on
 * the familiar sheet to fill in. Idempotent: a well that already has equipment
 * is returned untouched.
 */
export async function seedWellEquipmentTemplate(
  wellId: string
): Promise<WellEquipment[]> {
  const sb = await getSupabaseServer();
  const { data: existing, error: readErr } = await sb
    .from("well_equipment")
    .select(EQUIPMENT_COLS)
    .eq("well_id", wellId)
    .order("position", { ascending: true });
  if (readErr) throw new Error(`seedWellEquipmentTemplate (read): ${readErr.message}`);
  if (existing && existing.length > 0) return existing.map(mapEquipment);

  const rows = DEFAULT_EQUIPMENT_LABELS.map((label, index) => ({
    well_id: wellId,
    label,
    value: "",
    position: index,
  }));
  const { data, error } = await sb
    .from("well_equipment")
    .insert(rows)
    .select(EQUIPMENT_COLS)
    .order("position", { ascending: true });
  if (error) throw new Error(`seedWellEquipmentTemplate (insert): ${error.message}`);
  revalidatePath(`/wells/${wellId}`);
  return (data ?? []).map(mapEquipment);
}

/** Append a single blank equipment row to a well; returns it (for inline edit). */
export async function addWellEquipmentRow(
  wellId: string
): Promise<WellEquipment> {
  const sb = await getSupabaseServer();
  const position = await nextEquipmentPosition(sb, wellId);
  const { data, error } = await sb
    .from("well_equipment")
    .insert({ well_id: wellId, label: "", value: "", position })
    .select(EQUIPMENT_COLS)
    .single();
  if (error) throw new Error(`addWellEquipmentRow: ${error.message}`);
  revalidatePath(`/wells/${wellId}`);
  return mapEquipment(data);
}

/** Update an equipment row's label and/or value (inline edit). */
export async function updateWellEquipment(
  wellId: string,
  id: string,
  patch: { label?: string; value?: string }
): Promise<void> {
  const update: { label?: string; value?: string } = {};
  if (patch.label !== undefined) update.label = patch.label;
  if (patch.value !== undefined) update.value = patch.value;
  if (Object.keys(update).length === 0) return;

  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("well_equipment")
    .update(update)
    .eq("id", id)
    .eq("well_id", wellId);
  if (error) throw new Error(`updateWellEquipment: ${error.message}`);
  revalidatePath(`/wells/${wellId}`);
}

/** Delete an equipment row. */
export async function deleteWellEquipment(
  wellId: string,
  id: string
): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("well_equipment")
    .delete()
    .eq("id", id)
    .eq("well_id", wellId);
  if (error) throw new Error(`deleteWellEquipment: ${error.message}`);
  revalidatePath(`/wells/${wellId}`);
}

// --- Royalty owners (edited inline from a well's Royalty Owners tab) ---------
// These write the shared `royalty_owners` table (so edits show on /people too),
// and the `royalty_owner_wells` join that ties an owner to this well.

/** Editable royalty-owner fields, all optional for partial inline patches. */
export interface RoyaltyOwnerFields {
  name?: string;
  interestType?: RoyaltyOwner["interestType"];
  decimalInterest?: number;
  lastPayment?: number;
  email?: string;
  mailingAddress?: string;
}

/** Append a blank royalty owner linked to this well; returns it for inline edit. */
export async function addWellRoyaltyOwner(
  wellId: string
): Promise<RoyaltyOwner> {
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("royalty_owners")
    .insert({
      name: "",
      interest_type: "Royalty",
      decimal_interest: 0,
      last_payment: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`addWellRoyaltyOwner: ${error.message}`);

  const { error: linkError } = await sb
    .from("royalty_owner_wells")
    .insert({ royalty_owner_id: data.id, well_id: wellId });
  if (linkError) throw new Error(`addWellRoyaltyOwner (link): ${linkError.message}`);

  revalidatePath(`/wells/${wellId}`);
  revalidatePath("/people");
  return {
    id: data.id,
    name: "",
    interestType: "Royalty",
    decimalInterest: 0,
    wellIds: [wellId],
    email: "",
    mailingAddress: "",
    lastPayment: 0,
    description: "",
  };
}

/** Update a royalty owner's fields (inline edit). Leaves well links untouched. */
export async function updateWellRoyaltyOwner(
  wellId: string,
  id: string,
  patch: RoyaltyOwnerFields
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.interestType !== undefined) update.interest_type = patch.interestType;
  if (patch.decimalInterest !== undefined)
    update.decimal_interest = patch.decimalInterest;
  if (patch.lastPayment !== undefined) update.last_payment = patch.lastPayment;
  if (patch.email !== undefined) update.email = patch.email || null;
  if (patch.mailingAddress !== undefined)
    update.mailing_address = patch.mailingAddress || null;
  if (Object.keys(update).length === 0) return;

  const sb = await getSupabaseServer();
  const { error } = await sb.from("royalty_owners").update(update).eq("id", id);
  if (error) throw new Error(`updateWellRoyaltyOwner: ${error.message}`);
  revalidatePath(`/wells/${wellId}`);
  revalidatePath("/people");
}

/**
 * Remove a royalty owner's interest in this well (deletes the join row only).
 * The owner stays in the global table — they may hold interests in other wells.
 */
export async function removeWellRoyaltyOwner(
  wellId: string,
  id: string
): Promise<void> {
  const sb = await getSupabaseServer();
  const { error } = await sb
    .from("royalty_owner_wells")
    .delete()
    .eq("royalty_owner_id", id)
    .eq("well_id", wellId);
  if (error) throw new Error(`removeWellRoyaltyOwner: ${error.message}`);
  revalidatePath(`/wells/${wellId}`);
  revalidatePath("/people");
}

/**
 * Add equipment fields to a well in bulk (used by Archon's add_well_equipment
 * tool, e.g. filling a well file from an uploaded spec sheet). Blank fields (no
 * label) are dropped, and new rows are ordered after any existing ones.
 */
export async function addWellEquipment(
  wellId: string,
  fields: EquipmentField[]
): Promise<void> {
  const cleaned = fields
    .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
    .filter((f) => f.label.length > 0);
  if (cleaned.length === 0) return;

  const sb = await getSupabaseServer();
  const start = await nextEquipmentPosition(sb, wellId);
  const rows = cleaned.map((f, index) => ({
    well_id: wellId,
    label: f.label,
    value: f.value,
    position: start + index,
  }));
  const { error } = await sb.from("well_equipment").insert(rows);
  if (error) throw new Error(`addWellEquipment: ${error.message}`);
  revalidatePath(`/wells/${wellId}`);
}

/**
 * Post a comment on a well. Author is null until auth exists (renders as
 * "Unknown" after reload).
 */
export async function addComment(wellId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;
  const sb = await getSupabaseServer();

  // Stamp the author from the signed-in user: their profile name (falling back
  // to their email local-part), plus their auth id as a durable link. The
  // legacy `users` directory is never populated for real accounts, so we
  // denormalize the name rather than relying on author_id.
  const user = await getSessionUser();
  const profile = await getProfile();
  const authorName =
    profile.name.trim() || user?.email?.split("@")[0] || "Unknown";

  const { error } = await sb.from("well_comments").insert({
    well_id: wellId,
    body: trimmed,
    author_name: authorName,
    author_auth_id: user?.id ?? null,
  });
  if (error) throw new Error(`addComment: ${error.message}`);
  revalidatePath(`/wells/${wellId}`);
}

/**
 * Attach a single uploaded file to a well. Well files reuse the unified file
 * model — bytes → the shared `files` Storage bucket, metadata → `files`, and a
 * `file_placements` row into the well's subfolder under the `Wells` system root
 * (created on first use). Same de-duplicated storage as `/files` and
 * `/projects`; no per-well join table. The file is indexed for search so
 * Archon can read it. Returns the created file so the UI can render it without a
 * round-trip refresh. One file per call so the client can report per-file
 * status; the caller fans out across the selection.
 */
export async function uploadWellFile(
  wellId: string,
  formData: FormData
): Promise<WellFile> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("uploadWellFile: no file provided");
  }

  const sb = await getSupabaseServer();
  const folderId = await getOrCreateWellFolderId(sb, wellId);
  const id = crypto.randomUUID();
  const bytes = await file.arrayBuffer();

  // Bytes go to the private bucket via the admin client; the DB rows below go
  // through the request-scoped client so RLS assigns org_id and enforces
  // manage_files (well files are ordinary files in the unified model).
  const { error: upErr } = await getSupabaseAdmin()
    .storage.from(FILES_BUCKET)
    .upload(id, bytes, { contentType: file.type || undefined, upsert: false });
  if (upErr) throw new Error(`uploadWellFile (storage): ${upErr.message}`);

  // Extract text inline for text-like docs so Archon can search them right away;
  // binaries (PDF, images) are OCR'd later inside embedFile.
  const isText = /\.(md|markdown|txt|csv|tsv|json|las)$/i.test(file.name);
  const content = isText ? new TextDecoder().decode(bytes) : null;

  const type = fileType(file.name);
  const { error: fileErr } = await sb.from("files").insert({
    id,
    name: file.name,
    type,
    mime: file.type || null,
    size: file.size,
    storage_key: id,
    content,
  });
  if (fileErr) throw new Error(`uploadWellFile (files): ${fileErr.message}`);

  const { error: placeErr } = await sb
    .from("file_placements")
    .insert({ file_id: id, folder_id: folderId });
  if (placeErr) throw new Error(`uploadWellFile (placement): ${placeErr.message}`);

  // Index it so it's immediately searchable; never fail the upload over this.
  try {
    await embedFile(id);
  } catch (error) {
    console.error("embedFile (uploadWellFile) failed", error);
  }

  revalidatePath(`/wells/${wellId}`);
  revalidatePath("/files");

  return {
    id,
    name: file.name,
    type: type.toUpperCase(),
    sizeKb: Math.max(1, Math.round(file.size / 1024)),
    uploadedAt: new Date().toISOString().slice(0, 10),
  };
}
