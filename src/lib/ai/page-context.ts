/**
 * Describes where the user currently is in the app, so the Archon drawer chat
 * can resolve references like "this page", "this file", or "the selected
 * folder". Built on the client (it knows the route + the active selection) and
 * passed to `/api/chat`, which folds it into the system prompt.
 */
import { useMapAiContext } from "@/lib/ai/map-context";

/** A file, folder, or well the user currently has selected / open. */
export interface AiSelection {
  kind: "file" | "folder" | "well";
  id: string;
  name: string;
  /** File type (pdf, image, md, …) when `kind` is "file". */
  fileType?: string;
}

/** Friendly description of the page at `pathname`. */
export function describePage(pathname: string): string {
  if (pathname === "/") return "the Dashboard (home overview)";
  const segments = pathname.split("/").filter(Boolean);
  const [top, sub] = segments;
  switch (top) {
    case "files":
      return "the Files page (company document library)";
    case "wells":
      return sub ? `the detail page for well "${sub}"` : "the Wells list";
    case "tasks":
      return "the Tasks kanban board";
    case "calendar":
      return "the Calendar";
    case "inventory":
      return "the Inventory page";
    case "people":
      return "the People page (contractors, vendors, royalty owners)";
    case "projects":
      return sub
        ? `the "${sub}" project`
        : "the Projects page";
    case "pricing":
      return "the Pricing page (posted oil & gas prices vs benchmark, with projections)";
    case "archon":
      return "the Archon chat page";
    case "map":
      return "the Well Map (every Texas RRC oil & gas well, clustered)";
    default:
      return `the ${top ?? "home"} page`;
  }
}

/** One-paragraph context string for the system prompt. */
export function buildPageContext(
  pathname: string,
  selection: AiSelection | null
): string {
  const parts = [
    `The user is currently on ${describePage(pathname)} (route ${pathname}).`,
  ];
  if (selection?.kind === "file") {
    const type = selection.fileType ? ` (${selection.fileType.toUpperCase()})` : "";
    parts.push(
      `They have the file "${selection.name}"${type} open/selected — file id: ${selection.id}.`
    );
  } else if (selection?.kind === "folder") {
    parts.push(
      `They are browsing the folder "${selection.name}" — folder id: ${selection.id}.`
    );
  } else if (selection?.kind === "well") {
    parts.push(
      `They are viewing the well "${selection.name}" (well id: ${selection.id}). ` +
        `If they say "this well", "the well", or ask about a well without naming ` +
        `one, assume they mean this well and pass well id "${selection.id}" to the ` +
        `well tools.`
    );
  }
  if (pathname === "/map") {
    parts.push(buildMapContext());
  }
  return parts.join(" ");
}

/** Map-page context: the dataset, active filters, and the selected well. */
function buildMapContext(): string {
  const { well, filters } = useMapAiContext.getState();
  const api8 = (n: number) => String(n).padStart(8, "0");
  const lines: string[] = [
    "This is the Texas RRC Well Map: ~961,000 geocoded oil & gas wellbores from " +
      "the Railroad Commission, drawn as clustered points (green = oil, red = " +
      "gas, gray = unclassified). Every well has an 8-digit API number, RRC " +
      "district, county, type, total depth, plugged status, and a linked " +
      "operator (P-5 profile + officers).",
  ];

  if (filters) {
    const active: string[] = [];
    if (filters.oilGas !== "all") active.push(`type = ${filters.oilGas}`);
    if (filters.status !== "all") active.push(`status = ${filters.status}`);
    if (filters.district !== "all") active.push(`district ${filters.district}`);
    if (filters.county !== "all") active.push(`${filters.county} County`);
    if (filters.operator) active.push(`operator highlighted: ${filters.operator}`);
    lines.push(
      active.length
        ? `Active map filters: ${active.join("; ")}.`
        : "No map filters are active."
    );
  }

  if (well) {
    const facts = [
      `API ${api8(well.api)}`,
      well.county ? `${well.county} County` : null,
      well.district ? `District ${well.district}` : null,
      well.oilGas,
      well.totalDepth ? `${well.totalDepth.toLocaleString()} ft total depth` : null,
      well.plugged == null ? null : well.plugged ? "plugged" : "active",
      well.nFormations ? `${well.nFormations} formation tops` : null,
    ]
      .filter(Boolean)
      .join(", ");
    const op = well.operatorName
      ? `Operator: ${well.operatorName}` +
        (well.operatorNumber ? ` (#${well.operatorNumber})` : "") +
        (well.operatorStatus ? `, P-5 status ${well.operatorStatus}` : "") +
        (well.officerCount ? `, ${well.officerCount} officers on file` : "") +
        "."
      : "No operator is on file for this well (often a pre-1976 well).";
    lines.push(
      `The user currently has THIS well selected: ${facts}. ${op} If they say ` +
        `"this well", "the well", or ask about a well without naming one, they ` +
        `mean API ${api8(well.api)}. For deeper detail call well_lookup(${well.api}); ` +
        `for an operator's wells/profile call operator_lookup; for "how many" ` +
        `questions call count_wells.`
    );
  } else {
    lines.push(
      "No well is selected right now. For specific wells use well_lookup(api), " +
        "for operator profiles + their well counts use operator_lookup(name), " +
        "and for counts (e.g. \"how many gas wells in Midland County\") use " +
        "count_wells."
    );
  }
  return lines.join(" ");
}
