/**
 * System-prompt assembly for Archon.
 *
 * Archon's behavior is defined by six editable context documents (soul, app,
 * harness, skills, memory, persona) stored in `agent_context_docs` and loaded by
 * `lib/ai/context/docs.ts`. This module composes those docs into the final system
 * prompt, appending the live, generated pieces that can't be stored as static
 * text: the tool catalog (from the tool registry) and the data-universe manifest.
 *
 * The old static persona/tool-catalog constants moved into the seeded docs +
 * `lib/ai/context/defaults.ts`; the live tool list is generated in
 * `lib/ai/tool-catalog.ts` so it never drifts from `lib/ai/tools.ts`.
 */

import { getToolCatalog, renderToolCatalog } from "@/lib/ai/tool-catalog";
import type { ContextDocMap } from "@/lib/ai/context/docs";

export interface ArchonManifest {
  /** Folder paths/names so Archon knows where document types live. */
  folders: string[];
  /** Headline counts for orientation (e.g. { tasks: 8, folders: 5 }). */
  counts: Record<string, number>;
}

/** Who Archon is talking to — the signed-in user + their company, from Settings. */
export interface ArchonUser {
  /** The user's display name (may be empty if unset). */
  name?: string;
  /** Their company / operator name (may be empty if unset). */
  company?: string;
}

export function renderManifest(m: ArchonManifest): string {
  const folders = m.folders.map((f) => `- ${f}`).join("\n");
  const counts = Object.entries(m.counts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  return `Current data universe:

Folders:
${folders || "(none)"}

Totals: ${counts || "(none)"}`;
}

/**
 * The current date/time, grounded so Archon can resolve relative references like
 * "today", "this week", or "yesterday". Without this, the model has no anchor and
 * date-filtered tools (search_emails, list_calendar_events) get the wrong window.
 * Uses the server's IANA timezone, matching `lib/calendar/google-calendar.ts`.
 */
export function renderNow(now: Date): string {
  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const human = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(now);
  const iso = now.toISOString().slice(0, 10);
  return (
    `Today is ${human} (${iso}, ${timeZone}). Use this to resolve relative ` +
    `dates like "today", "this week", or "yesterday" — pass concrete ` +
    `YYYY-MM-DD values to date-filtered tools rather than guessing.`
  );
}

/** Body describing the signed-in user — the fallback when persona.md is empty. */
export function renderUser(user: ArchonUser): string {
  const name = user.name?.trim();
  const company = user.company?.trim();
  const lines: string[] = [];
  if (name) lines.push(`You are speaking with ${name}.`);
  if (company) lines.push(`They operate ${company}.`);
  if (lines.length === 0) return "";
  return (
    `${lines.join(" ")} Address them by name when it's natural, and refer to ` +
    `the company by name where it fits, but don't force either into every reply.`
  );
}

const SECTION_SEPARATOR = "\n\n---\n\n";

interface AssembleArgs {
  /** The six context docs, already resolved (DB content or defaults). */
  docs: ContextDocMap;
  /** Live data-universe manifest, appended under App.md when available. */
  manifest?: ArchonManifest;
  /** Profile fallback for the persona section when persona.md is empty. */
  user?: ArchonUser;
  /** Where the user is right now (route + selection), if known. */
  pageContext?: string;
  /** Current time, for grounding relative dates. Defaults to now; injectable for tests. */
  now?: Date;
}

/**
 * Compose the full system prompt from the context docs plus the live tool
 * catalog and manifest. Order: guardrails first (harness), then identity (soul),
 * then the app + its tools + live data, then who the user is, working memory,
 * the skills menu, and finally where the user currently is.
 */
export function assembleSystemPrompt({
  docs,
  manifest,
  user,
  pageContext,
  now = new Date(),
}: AssembleArgs): string {
  const sections: string[] = [];

  if (docs.harness.trim()) {
    sections.push(`## Safety and constraints\n\n${docs.harness.trim()}`);
  }

  if (docs.soul.trim()) sections.push(docs.soul.trim());

  sections.push(`## Current date and time\n\n${renderNow(now)}`);

  // App: the static description + the live tool list + the live manifest.
  const appParts = [docs.app.trim(), renderToolCatalog(getToolCatalog())];
  if (manifest) appParts.push(renderManifest(manifest));
  const app = appParts.filter(Boolean).join("\n\n");
  if (app) sections.push(app);

  // Persona: the doc if set, else a line derived from the signed-in profile.
  const persona = docs.persona.trim() || (user ? renderUser(user) : "");
  if (persona) sections.push(`## Who you're talking to\n\n${persona}`);

  if (docs.memory.trim()) {
    sections.push(`## Memory (what you've learned so far)\n\n${docs.memory.trim()}`);
  }

  if (docs.skills.trim()) sections.push(`## Skills\n\n${docs.skills.trim()}`);

  if (pageContext?.trim()) {
    sections.push(
      `## Where the user is\n\n${pageContext.trim()}\n\n` +
        `Use this to resolve references like "this page", "this file", or "the ` +
        `selected document". When the user refers to the open file, use its file ` +
        `id with read_file / describe_dataset rather than guessing.`
    );
  }

  return sections.join(SECTION_SEPARATOR);
}
