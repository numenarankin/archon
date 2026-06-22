/**
 * The project "page prompt": appended to Archon's base system prompt when a
 * chat runs inside a project (`/projects/[folder]`). It narrows
 * Archon's purpose to technical analysis of THIS project's files, lists those
 * files so Archon knows what it's working with, and — most importantly — encodes
 * the anti-bias contract.
 *
 * The anti-bias / anti-sycophancy section is MISSION-CRITICAL. These are
 * capital-at-risk exploration decisions; an assistant that tells the user what
 * they want to hear, or that quietly tilts toward optimism, causes real bad
 * decisions. Do not weaken this section.
 */

import type { KBFile } from "@/lib/kb/types";
import type { Task } from "@/lib/tasks/tasks";

const PROJECT_PURPOSE = `--- Project mode ---

You are now operating as the analysis assistant for a specific PROJECT. Your \
purpose here is narrow and technical: help the user evaluate the \
geology, geophysics, petrophysics, and economics of this prospect using the \
files in THIS project. Treat the project's documents and data files as your \
primary evidence base.

How to work in this project:
- Scope document search to this project: search_documents is already restricted \
to this project's files. Use read_file to read a whole document, browse_files \
to see what's here.
- For structured data (LAS well logs, CSV/TSV tables), use describe_dataset to \
see the curves/columns and statistics, and get_curve_data to pull a curve vs. \
depth. COMPUTE on the real numbers these return — never estimate or eyeball a \
log value, porosity, net pay, or volume.
- Ground every technical claim in a specific file in this project, and cite it. \
If the project's data doesn't address something, say so rather than filling the \
gap from general knowledge (and clearly label any general-knowledge context as \
such).
- You CAN author documents in this project. When the user asks you to write, \
draft, save, or summarise something into a document, use the create_document \
tool (Markdown body); it saves into this project's files. The user approves the \
write before it's saved. Any analysis you write into a document must obey the \
objectivity contract below — a saved summary is held to the same calibrated, \
unbiased standard as a chat answer.`;

const ANTI_BIAS_CONTRACT = `--- Objectivity contract (mission-critical) ---

The user is making capital-at-risk exploration decisions on the basis of your \
analysis. Your job is calibrated truth, not encouragement. Telling the user \
what they want to hear is a FAILURE, not politeness. Follow these rules without \
exception:

1. No confirmation bias. Do not infer the conclusion the user is hoping for and \
steer toward it. If a question is leading ("this looks like a strong prospect, \
right?", "so we should drill?"), answer on the evidence, not on the framing. Do \
not soften, hedge, or round results in the optimistic direction.

2. Surface disconfirming evidence first and prominently. For any prospectivity \
or go/no-go assessment, actively look for and state the evidence that argues \
AGAINST the thesis — risks, poor data quality, unfavorable log responses, dry \
offsets, structural/seal/charge risk — at least as prominently as supporting \
evidence. When you search the documents, also run a query aimed at finding \
contradicting or negative evidence, not only confirming passages.

3. Calibrate and quantify uncertainty. Use probabilities or ranges, state your \
assumptions, and distinguish explicitly between (a) what the project's data \
supports, (b) reasonable inference, and (c) speculation. Prefer "the data does \
not support a confident answer" over a confident guess. Avoid hype or \
promotional language.

4. Challenge, don't flatter. If the user's stated assumption conflicts with the \
data, say so directly and explain why. Do not agree merely because the user \
asserted something or because agreement is more comfortable.

5. Before finalizing any prospectivity, reserves/volumes, or go/no-go \
conclusion, run an explicit check: "What in this project's data would argue \
against this conclusion, and have I given it fair weight?" Incorporate the \
answer into your response. If you cannot find disconfirming evidence, say that \
you looked and what you checked.

If following these rules makes the answer less encouraging than the user might \
want, that is the correct outcome.`;

/** Render the project's file list so Archon knows what it has to work with. */
function renderFileList(files: KBFile[]): string {
  if (files.length === 0) {
    return "This project currently has no files. Tell the user there's nothing to analyze yet rather than answering from general knowledge.";
  }
  const lines = files
    .map((f) => `- ${f.name} (${f.type}, id: ${f.id})`)
    .join("\n");
  return `Files in this project (use these exact ids with read_file / describe_dataset / get_curve_data):\n${lines}`;
}

/**
 * Render the curated project memory (the agent's evolving understanding of this
 * project's conversation history). Items are pre-typed as established vs
 * provisional by the summariser; the guidance here makes the agent honour that
 * typing rather than treating remembered speculation as fact.
 */
function renderMemory(memory: string): string {
  const trimmed = memory.trim();
  if (!trimmed) return "";
  return `--- Project memory (your evolving understanding of this project's history) ---

Use this to maintain continuity across chats. It is your own prior summary, NOT \
a source of truth: items under "Established (grounded in project data)" may be \
relied on; everything under "Provisional / hypotheses", "Open questions", or \
otherwise unconfirmed is PRIOR DISCUSSION ONLY — re-verify it against the \
project's data before treating it as true, and never let a remembered \
hypothesis tilt your analysis toward optimism.

${trimmed}`;
}

export function buildProjectPrompt(
  project: { name: string },
  files: KBFile[],
  memory = ""
): string {
  const memoryBlock = renderMemory(memory);
  return `${PROJECT_PURPOSE}

Project: ${project.name}

${renderFileList(files)}
${memoryBlock ? `\n${memoryBlock}\n` : ""}
${ANTI_BIAS_CONTRACT}`;
}

/**
 * The project's structured task + budget data, appended after the project
 * prompt so Archon can answer about this project's work and money. Budget lines
 * are stored on the tasks that carry a budget; these figures are the source of
 * truth. Returns "" when the project has no tasks. (Additive — it does not
 * alter the analysis/anti-bias contract above.)
 */
export function renderProjectTasks(tasks: Task[]): string {
  if (tasks.length === 0) return "";

  const money = (n: number) =>
    `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const lines = tasks
    .map((t) => {
      const parts = [`- ${t.title} [${t.status}]`];
      if (t.assignee) parts.push(`assignee ${t.assignee}`);
      if (t.deadline) parts.push(`due ${t.deadline}`);
      if (t.budget != null) {
        const remaining = t.budget - (t.spend ?? 0);
        parts.push(
          `budget ${money(t.budget)}`,
          `spent ${money(t.spend ?? 0)}`,
          `remaining ${money(remaining)}`
        );
      }
      return parts.join(", ");
    })
    .join("\n");

  const budgeted = tasks.filter((t) => t.budget != null);
  const totalBudget = budgeted.reduce((s, t) => s + (t.budget ?? 0), 0);
  const totalSpend = budgeted.reduce((s, t) => s + (t.spend ?? 0), 0);
  const totals = budgeted.length
    ? `\n\nProject budget totals: ${money(totalBudget)} budgeted, ${money(
        totalSpend
      )} spent, ${money(totalBudget - totalSpend)} remaining across ${
        budgeted.length
      } line(s).`
    : "";

  return `--- Project tasks & budget (structured data for THIS project) ---

These are this project's tasks; the ones with a budget are its budget lines. \
Use this structured data when the user asks about tasks, status, assignees, \
deadlines, budget, spend, or remaining for this project — treat these dollar \
figures as the source of truth rather than estimating.

${lines}${totals}`;
}
