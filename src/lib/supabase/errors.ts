/**
 * Helpers for interpreting Supabase/PostgREST errors. These arrive as plain
 * objects (not Error instances), so a bare `console.error(err)` logs an unhelpful
 * "{}". Use `describeError` for a readable message, and `isAbsentRelation` to
 * recognise the "this table/function was never migrated" case so callers can
 * treat a missing feature as empty data rather than a failure.
 */

/** A readable one-line description of an unknown thrown value. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const e = error as { message?: string; code?: string };
    if (e.message) return `${e.message}${e.code ? ` (${e.code})` : ""}`;
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * True when the error means the relation/function simply isn't provisioned in
 * this database — the table was never migrated (this app is single-tenant and
 * has no org tables, for instance) — or the schema cache hasn't loaded yet.
 * Both are expected "feature not present" conditions, not real failures.
 */
export function isAbsentRelation(error: unknown): boolean {
  const code = (error as { code?: string } | null | undefined)?.code;
  return (
    code === "42P01" || // undefined_table
    code === "42883" || // undefined_function (rpc)
    code === "PGRST205" || // table not found in schema cache
    code === "PGRST202" || // function not found in schema cache
    code === "PGRST002" || // schema cache could not be queried (cold start)
    code === "PGRST001"
  );
}
