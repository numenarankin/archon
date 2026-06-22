import { hasSupabase } from "@/lib/env";
import { getSupabaseServer } from "@/lib/supabase/server";
import { findWellFolderId } from "@/lib/wells/well-folder";

/**
 * A producing oil well and its current economics.
 *
 * Production figures are daily rates; monetary figures are in US dollars.
 */
export interface Well {
  /** Stable identifier / URL slug for the well. */
  id: string;
  /** Operator-assigned well name. */
  name: string;
  /** Total measured depth, in feet. */
  depth: number;
  /** Producing formation / zone. */
  zone: string;
  /** Perforated interval, in feet (top–bottom). */
  perforations: string;
  /** County the surface location sits in. */
  county: string;
  /** Surface-location coordinates, free-form (e.g. "31.9686, -102.0779"). */
  coordinates: string;
  /** Date the well was drilled, as an ISO `YYYY-MM-DD` string, or "" if unknown. */
  dateDrilled: string;
  /** Oil production rate, in barrels per day. */
  oilProduction: number;
  /** Gas production rate, in thousand cubic feet (MCF) per day. */
  gasProduction: number;
  /** Produced (salt) water rate, in barrels per day. */
  saltWater: number;
  /** Monthly gross revenue, in US dollars. */
  revenue: number;
  /** Lifting cost, in US dollars per barrel of oil. */
  liftingCost: number;
  /** Monthly profit / loss, in US dollars (negative = loss). */
  pl: number;
  /**
   * Barrels of oil per inch of tank gauge. Readings are entered in gauge inches;
   * the UI multiplies oil production / stock / sales by this to show barrels.
   * Defaults to 1 (1:1, no conversion).
   */
  oilBblPerInch: number;
}

interface WellRow {
  id: string;
  name: string;
  zone: string | null;
  perforations: string | null;
  county: string | null;
  coordinates: string | null;
  depth: number | null;
  date_drilled: string | null;
  oil_production: number | null;
  gas_production: number | null;
  salt_water: number | null;
  revenue: number | null;
  lifting_cost: number | null;
  pl: number | null;
  oil_bbl_per_inch: number | null;
}

function mapWell(r: WellRow): Well {
  return {
    id: r.id,
    name: r.name,
    depth: r.depth ?? 0,
    zone: r.zone ?? "",
    perforations: r.perforations ?? "",
    county: r.county ?? "",
    coordinates: r.coordinates ?? "",
    dateDrilled: r.date_drilled ?? "",
    oilProduction: r.oil_production ?? 0,
    gasProduction: r.gas_production ?? 0,
    saltWater: r.salt_water ?? 0,
    revenue: r.revenue ?? 0,
    liftingCost: r.lifting_cost ?? 0,
    pl: r.pl ?? 0,
    oilBblPerInch: r.oil_bbl_per_inch ?? 1,
  };
}

/** Returns all wells, ordered by name. */
export async function getWells(): Promise<Well[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb.from("wells").select("*").order("name");
  if (error) throw new Error(`getWells: ${error.message}`);
  return (data ?? []).map(mapWell);
}

/** Returns a single well by its id / slug, or `null` when it does not exist. */
export async function getWell(id: string): Promise<Well | null> {
  if (!hasSupabase()) return null;
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("wells")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getWell: ${error.message}`);
  return data ? mapWell(data) : null;
}

/** Returns a lookup of well id → well name, for labelling references to wells. */
export async function getWellNameMap(): Promise<Record<string, string>> {
  const wells = await getWells();
  return Object.fromEntries(wells.map((well) => [well.id, well.name]));
}

/**
 * A single day of production for a well.
 */
export interface ProductionPoint {
  /** Row id, when loaded from the database (absent for unsaved/optimistic rows). */
  id?: string;
  /** Production date as an ISO `YYYY-MM-DD` string. */
  date: string;
  /** Reading time as a 24-hour `HH:MM` string. */
  time: string;
  oilProduction: number;
  /** Oil held in tanks (lease inventory), in barrels. */
  oilStock: number;
  /** Oil sold / hauled, in barrels per day. */
  oilSales: number;
  gasProduction: number;
  saltWater: number;
}

interface ProductionRow {
  id: string;
  reading_date: string;
  reading_time: string | null;
  oil_production: number | null;
  oil_stock: number | null;
  oil_sales: number | null;
  gas_production: number | null;
  salt_water: number | null;
}

function mapProduction(r: ProductionRow): ProductionPoint {
  return {
    id: r.id,
    date: r.reading_date,
    time: (r.reading_time ?? "").slice(0, 5),
    oilProduction: r.oil_production ?? 0,
    oilStock: r.oil_stock ?? 0,
    oilSales: r.oil_sales ?? 0,
    gasProduction: r.gas_production ?? 0,
    saltWater: r.salt_water ?? 0,
  };
}

/** Returns the production history for a well, oldest reading first. */
export async function getWellProduction(
  id: string
): Promise<ProductionPoint[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("production_readings")
    .select(
      "id, reading_date, reading_time, oil_production, oil_stock, oil_sales, gas_production, salt_water"
    )
    .eq("well_id", id)
    .order("reading_date", { ascending: true })
    .order("reading_time", { ascending: true });
  if (error) throw new Error(`getWellProduction: ${error.message}`);
  return (data ?? []).map(mapProduction);
}

/** A comment left on a well by a member of the operations team. */
export interface WellComment {
  id: string;
  author: string;
  /** Author initials, for the avatar fallback. */
  initials: string;
  /** Creation time as an ISO timestamp. */
  createdAt: string;
  body: string;
}

interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  /** Denormalized author display name, captured from the writer's profile. */
  author_name: string | null;
  /** Legacy directory join — null for all real comments. */
  users: { name: string | null; initials: string | null } | null;
}

export function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Returns the comments left on a well, newest first. */
export async function getWellComments(id: string): Promise<WellComment[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("well_comments")
    .select("id, body, created_at, author_name, users(name, initials)")
    .eq("well_id", id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getWellComments: ${error.message}`);
  return ((data ?? []) as unknown as CommentRow[]).map((r) => {
    // Prefer the denormalized author name; fall back to the legacy directory
    // join, then to "Unknown" for pre-auth rows that have neither.
    const name = r.author_name ?? r.users?.name ?? "Unknown";
    return {
      id: r.id,
      author: name,
      initials: r.users?.initials ?? initialsFrom(name),
      createdAt: r.created_at,
      body: r.body,
    };
  });
}

/**
 * One field on a well's equipment / wellbore spec sheet — a flexible label →
 * value pair (e.g. "Tbg Pump" → "2.25\" x 20'BN"). A well's equipment is an
 * ordered list of these, with a set of standard fields offered as defaults and
 * room for arbitrary custom rows.
 */
export interface WellEquipment {
  id: string;
  /** Field name, e.g. "Tbg Pump", "Casing", "Motor". */
  label: string;
  /** Field value, free text. */
  value: string;
  /** Display order within the sheet. */
  position: number;
}

/** An equipment field as supplied by the UI / tools, before it has a row id. */
export interface EquipmentField {
  label: string;
  value: string;
}

interface EquipmentRow {
  id: string;
  label: string | null;
  value: string | null;
  position: number | null;
}

/** Returns a well's equipment fields, in sheet order. */
export async function getWellEquipment(id: string): Promise<WellEquipment[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();
  const { data, error } = await sb
    .from("well_equipment")
    .select("id, label, value, position")
    .eq("well_id", id)
    .order("position", { ascending: true });
  if (error) throw new Error(`getWellEquipment: ${error.message}`);
  return ((data ?? []) as EquipmentRow[]).map((r) => ({
    id: r.id,
    label: r.label ?? "",
    value: r.value ?? "",
    position: r.position ?? 0,
  }));
}

/** A document or file attached to a well. */
export interface WellFile {
  id: string;
  name: string;
  type: string;
  /** File size in kilobytes. */
  sizeKb: number;
  /** Upload date as an ISO `YYYY-MM-DD` string. */
  uploadedAt: string;
}

interface WellFilePlacement {
  created_at: string;
  files: {
    id: string;
    name: string;
    type: string | null;
    size: number | null;
    created_at: string;
  } | null;
}

/**
 * Returns the files attached to a well, newest first.
 *
 * Well files reuse the unified file model: each well has a subfolder under the
 * `Wells` system root (named by the well id) and its files are ordinary `files`
 * placed there via `file_placements` — the same de-duplicated storage `/files`
 * and `/projects` use. No per-well join table.
 */
export async function getWellFiles(id: string): Promise<WellFile[]> {
  if (!hasSupabase()) return [];
  const sb = await getSupabaseServer();

  const folderId = await findWellFolderId(sb, id);
  if (!folderId) return [];

  const { data, error } = await sb
    .from("file_placements")
    .select("created_at, files(id, name, type, size, created_at)")
    .eq("folder_id", folderId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getWellFiles: ${error.message}`);

  return ((data ?? []) as unknown as WellFilePlacement[]).flatMap((row) => {
    const file = row.files;
    if (!file) return [];
    return [
      {
        id: file.id,
        name: file.name,
        type: (file.type ?? "file").toUpperCase(),
        sizeKb: Math.max(1, Math.round((file.size ?? 0) / 1024)),
        uploadedAt: (row.created_at ?? file.created_at ?? "").slice(0, 10),
      },
    ];
  });
}
