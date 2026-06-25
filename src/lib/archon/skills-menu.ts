/**
 * Regenerates the Skills.md "menu" — the succinct, one-line-per-skill summary
 * that Archon reads each turn to route a request to the right skill(s). The menu
 * is DERIVED state: users author full skill docs (built-ins in code, custom
 * skills in `archon_skills`), and this rebuilds the condensed menu into the
 * `skills` context doc whenever a skill changes (create/edit/delete/toggle).
 *
 * Runs in the background after a skill write (never on the chat hot path), so the
 * per-turn cost is just reading one stored doc. Summaries are deterministic from
 * each skill's short description; a custom skill that has only a long markdown
 * body (no crisp description) gets a one-line distillation from the model.
 */

import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { ARCHON_SKILLS, type ArchonSkill } from "@/lib/archon/skills";
import { getCustomSkills } from "@/lib/archon/skills-store";
import { updateContextDoc } from "@/lib/ai/context/docs";

const SUMMARY_MODEL = "claude-opus-4-8";

const PREAMBLE = `This menu lists Archon's skills: each is a named capability backed by specific tools. For EVERY request, silently work out which skill(s) it needs and invoke the matching tools right away, without waiting to be told. Chain skills when a task spans several, and prefer acting over asking when the next step is obvious. Skills are an internal routing aid: don't list them or announce which you're using. If nothing fits, just answer directly.`;

/** A description short enough to use verbatim as the menu line. */
function isCrisp(description: string): boolean {
  const d = description.trim();
  return d.length > 0 && d.length <= 240;
}

/** Distill a long skill body into one menu line (when no crisp description). */
async function summarizeBody(name: string, body: string): Promise<string> {
  const { text } = await generateText({
    model: anthropic(SUMMARY_MODEL),
    system:
      "Summarize what a single AI assistant skill does in ONE short sentence (max 25 words): what it does and when to use it. Plain text, no markdown, no em dashes, no preamble.",
    prompt: `Skill name: ${name}\n\nSkill instructions:\n${body}`,
  });
  return text.trim().replace(/\s+/g, " ");
}

/** Build the menu line for one skill: "- Name: summary (tools: a, b)". */
async function menuLine(skill: ArchonSkill): Promise<string> {
  const summary = isCrisp(skill.description)
    ? skill.description.trim()
    : skill.content?.trim()
      ? await summarizeBody(skill.name, skill.content)
      : skill.description.trim() || "(no description)";
  const tools = skill.tools.filter((t) => t && t !== "custom");
  const toolNote = tools.length ? ` (tools: ${tools.join(", ")})` : "";
  return `- ${skill.name}: ${summary}${toolNote}`;
}

/**
 * Rebuild the Skills.md menu from the built-in catalog plus the enabled custom
 * skills, and write it to the `skills` context doc. Best-effort: logs and
 * swallows failures so a skill save never fails on menu regeneration.
 */
export async function regenerateSkillsMenu(): Promise<void> {
  try {
    const custom = await getCustomSkills();
    const skills = [
      ...ARCHON_SKILLS,
      ...custom.filter((s) => s.enabledByDefault),
    ];

    const lines = await Promise.all(skills.map(menuLine));
    const menu = `${PREAMBLE}\n\n${lines.join("\n")}`;

    await updateContextDoc("skills", menu, { updatedBy: "system" });
  } catch (err) {
    console.error("regenerateSkillsMenu failed", err);
  }
}
