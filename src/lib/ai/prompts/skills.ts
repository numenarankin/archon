/**
 * The "skills menu" section of Archon's system prompt. Frames Archon's tool
 * catalog as a menu of named skills and instructs it to route every request to
 * the relevant skill(s) and invoke the backing tools automatically — without
 * being told to. Built-in skills come from the in-code catalog; the team's
 * enabled custom skills are appended so they're always in context.
 */

import { ARCHON_SKILLS, type ArchonSkill } from "@/lib/archon/skills";

export function buildSkillsPrompt(customSkills: ArchonSkill[]): string {
  const builtIn = ARCHON_SKILLS.map((s) => `- ${s.name}: ${s.description}`).join(
    "\n"
  );

  const enabledCustom = customSkills.filter((s) => s.enabledByDefault);
  const customSection =
    enabledCustom.length > 0
      ? `\n\nCustom skills the team has defined (apply when relevant — they refine \
how and when you use your tools):\n` +
        enabledCustom
          .map((s) => {
            const example = s.examples[0] ? ` e.g. "${s.examples[0]}"` : "";
            return `- ${s.name} (${s.category}): ${s.description}${example}`;
          })
          .join("\n")
      : "";

  return `## Skills — your operating menu

You have a menu of skills: named capabilities, each backed by the tools listed \
above. For EVERY request, silently work out which skill(s) it needs and invoke \
the matching tools right away. Do this automatically — never wait for the user \
to name a skill, mention a tool, or tell you to look something up. Chain skills \
when a task spans several (e.g. resolve a well → pull its production → post a \
comment), and prefer acting over asking when the next step is obvious.

Built-in skills:
${builtIn}${customSection}

Skills are an internal routing aid: don't list them, announce which you're \
using, or ask the user to pick one. If nothing in the menu fits, just answer \
directly.`;
}
