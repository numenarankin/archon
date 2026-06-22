import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  smoothStream,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import {
  buildProjectPrompt,
  renderProjectTasks,
} from "@/lib/ai/prompts/projects";
import { buildSkillsPrompt } from "@/lib/ai/prompts/skills";
import { buildManifest } from "@/lib/ai/manifest";
import { archonTools } from "@/lib/ai/tools";
import { getFolderFiles } from "@/lib/kb/files";
import { getTasks } from "@/lib/tasks/tasks";
import { getProjectMemory } from "@/lib/ai/project-memory";
import { getCustomSkills } from "@/lib/archon/skills-store";
import { getProfile } from "@/lib/settings/profile";
import { forbidUnlessPermitted } from "@/lib/auth/permissions";

// Tool round-trips can take a while; allow longer than a plain completion.
export const maxDuration = 120;

interface ChatRequest {
  messages: UIMessage[];
  /** Present when the chat runs inside a project. */
  folderId?: string;
  projectName?: string;
  /** Where the user currently is (route + selected file/folder), if known. */
  pageContext?: string;
}

export async function POST(req: Request) {
  // Capability gate: a member without `use_ai` can't use Archon — enforced here
  // (not just in the UI) so the model is never invoked from a direct API call.
  const denied = await forbidUnlessPermitted("use_ai");
  if (denied) return denied;

  const { messages, folderId, projectName, pageContext }: ChatRequest =
    await req.json();

  // Ground the system prompt in the live data universe (well names → ids,
  // folder tree, counts) so Archon can resolve references without a lookup, and
  // load the team's custom skills for the skills menu.
  const [manifest, customSkills, profile] = await Promise.all([
    buildManifest(),
    getCustomSkills(),
    getProfile(),
  ]);
  let system = buildSystemPrompt(manifest, {
    name: profile.name,
    company: profile.companyName,
  });

  // The skills menu: tells Archon the catalog of capabilities and to route each
  // request to the right skill(s) and invoke their tools automatically.
  system += `\n\n---\n\n${buildSkillsPrompt(customSkills)}`;

  // Inside a project: scope the assistant to this project's files,
  // load its curated memory, and append the project page prompt (purpose +
  // anti-bias contract + project memory).
  if (folderId) {
    const [files, memory, tasks] = await Promise.all([
      getFolderFiles(folderId),
      getProjectMemory(folderId),
      getTasks(folderId),
    ]);
    system += `\n\n---\n\n${buildProjectPrompt(
      { name: projectName ?? "this project" },
      files,
      memory
    )}`;
    // Additive: give the project chat visibility into the project's structured
    // task + budget data (does not alter the analysis/anti-bias prompt above).
    const taskBlock = renderProjectTasks(tasks);
    if (taskBlock) system += `\n\n---\n\n${taskBlock}`;
  }

  // Tell Archon where the user is right now so it can resolve "this page" /
  // "this file" / "the selected folder" without asking.
  if (pageContext) {
    system +=
      `\n\n---\n\n## Where the user is\n\n${pageContext}\n\n` +
      `Use this to resolve references like "this page", "this file", or "the ` +
      `selected document". When the user refers to the open file, use its file ` +
      `id with read_file / describe_dataset rather than guessing.`;
  }

  const result = streamText({
    model: anthropic("claude-opus-4-8"),
    system,
    messages: await convertToModelMessages(messages),
    tools: archonTools(folderId),
    // Autonomous multi-step retrieval, capped as a runaway/cost guard.
    stopWhen: stepCountIs(10),
    // Keep context bounded on long conversations without orphaning a tool result.
    prepareStep: async ({ messages: stepMessages }) => {
      if (stepMessages.length <= 40) return {};
      let trimmed = stepMessages.slice(-30);
      while (trimmed.length > 0 && trimmed[0].role === "tool") {
        trimmed = trimmed.slice(1);
      }
      return { messages: trimmed };
    },
    experimental_transform: smoothStream({ delayInMs: 15, chunking: "word" }),
  });

  return result.toUIMessageStreamResponse();
}
