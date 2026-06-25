/**
 * Archon's skills — the capability modules the assistant can draw on, surfaced
 * on the Skills page so the team can see (and toggle) what Archon is allowed to
 * do. Each skill maps to one or more of the underlying tools defined in
 * `src/lib/ai/tools.ts`; the `tools` list names them for reference.
 *
 * This is the catalog/seed. Enablement is currently held in the page's local
 * state — wiring it to a persisted, per-workspace setting that actually gates
 * the tools handed to the model is a follow-up.
 */

export type SkillCategory =
  | "Data"
  | "Documents"
  | "Analysis"
  | "Productivity"
  | "Memory";

export interface ArchonSkill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  /** Lucide icon key resolved by the UI (see SKILL_ICONS). */
  icon: string;
  /** Underlying tool names this skill is backed by (its tool allowlist). */
  tools: string[];
  /** Full markdown body (custom skills only): how and when to use the skill. */
  content?: string;
  /** Example prompts that exercise the skill. */
  examples: string[];
  /** Enabled out of the box. */
  enabledByDefault: boolean;
  /** Mutates company data — every action is gated behind explicit approval. */
  requiresApproval?: boolean;
  /** Built-in skills can't be deleted from the catalog. */
  builtIn: boolean;
}

export const SKILL_CATEGORIES: SkillCategory[] = [
  "Documents",
  "Analysis",
  "Productivity",
  "Memory",
];

export const ARCHON_SKILLS: ArchonSkill[] = [
  {
    id: "document-search",
    name: "Document Search",
    description:
      "Search and read the company's documents (reports, notes, and OCR'd PDFs) and browse the file tree to find where something lives.",
    category: "Documents",
    icon: "file-search",
    tools: ["search_documents", "read_file", "browse_files"],
    examples: [
      "Find our standard MSA terms.",
      "Summarize the latest board update.",
    ],
    enabledByDefault: true,
    builtIn: true,
  },
  {
    id: "dataset-analysis",
    name: "Dataset Analysis",
    description:
      "Read structured data files (CSV/TSV tables, and LAS logs) for their columns and statistics, and pull samples to compute on.",
    category: "Analysis",
    icon: "line-chart",
    tools: ["describe_dataset", "get_curve_data"],
    examples: [
      "What columns are in this CSV and what do they range over?",
      "Pull the values from the revenue column so I can total them.",
    ],
    enabledByDefault: true,
    builtIn: true,
  },
  {
    id: "document-authoring",
    name: "Document Authoring",
    description:
      "Draft and save new Markdown documents (a summary, memo, or write-up) into a project's files, and edit existing documents — both indexed for search. Edits always ask for your approval first.",
    category: "Documents",
    icon: "pencil",
    tools: ["create_document", "edit_document"],
    examples: [
      "Draft a one-page summary of this project and save it.",
      "Write up a memo from the notes in this folder.",
      "Update the prospect summary to add a risks section.",
    ],
    enabledByDefault: true,
    requiresApproval: true,
    builtIn: true,
  },
  {
    id: "diagrams",
    name: "Diagrams",
    description:
      "Read diagrams the team drew (flowcharts, processes, org charts, sketches) and answer questions about them, draw new diagrams from a description, and turn an uploaded photo of a whiteboard or sketch into an editable diagram.",
    category: "Documents",
    icon: "shapes",
    tools: ["read_diagram", "create_diagram", "edit_diagram"],
    examples: [
      "Turn this photo of our whiteboard into a diagram.",
      "Draw the lease acquisition workflow as a flowchart.",
      "What does this diagram say happens after due diligence?",
    ],
    enabledByDefault: true,
    requiresApproval: true,
    builtIn: true,
  },
  {
    id: "tasks-scheduling",
    name: "Task Board",
    description:
      "Review the kanban board and open new tasks, with status, priority, assignee, deadlines, and blocking dependencies (what's waiting on what).",
    category: "Productivity",
    icon: "list-todo",
    tools: ["list_tasks", "create_task"],
    examples: [
      "What's in progress right now?",
      "Add a high-priority task to follow up with the new lead.",
    ],
    enabledByDefault: true,
    requiresApproval: true,
    builtIn: true,
  },
  {
    id: "conversation-recall",
    name: "Conversation Recall",
    description:
      "Search past Archon conversations and read them in full to pick up where an earlier discussion left off.",
    category: "Memory",
    icon: "messages-square",
    tools: ["search_chat_history", "read_conversation"],
    examples: [
      "What did we decide about the pricing model?",
      "Pull up our earlier chat about the hiring plan.",
    ],
    enabledByDefault: true,
    builtIn: true,
  },
  {
    id: "memory",
    name: "Memory & Preferences",
    description:
      "Remember durable facts and preferences (naming conventions, priorities, how you like things) and recall them in future chats.",
    category: "Memory",
    icon: "brain",
    tools: ["remember", "recall_memory"],
    examples: [
      "Remember that I prefer short, bulleted answers.",
      "What did I say my priorities were this quarter?",
    ],
    enabledByDefault: true,
    builtIn: true,
  },
  {
    id: "email",
    name: "Email",
    description:
      "Search and read your Gmail with filters (sender, unread, keywords, date range) to answer questions about your mail, and draft replies for you to review and send. Archon never sends — drafts only.",
    category: "Productivity",
    icon: "mail",
    tools: ["search_emails", "read_email", "draft_email"],
    examples: [
      "Summarize my unread inbox.",
      "Any emails from Dana about the gathering agreement this week?",
      "Draft a reply to Cole agreeing to the lease extension.",
    ],
    enabledByDefault: true,
    requiresApproval: true,
    builtIn: true,
  },
  {
    id: "calendar",
    name: "Calendar",
    description:
      "Read your Google Calendar to answer scheduling questions, and add or update events.",
    category: "Productivity",
    icon: "calendar",
    tools: [
      "list_calendar_events",
      "create_calendar_event",
      "update_calendar_event",
    ],
    examples: [
      "What's on my calendar this week?",
      "Schedule a tank haul-off for Thursday at 9am.",
    ],
    enabledByDefault: true,
    requiresApproval: true,
    builtIn: true,
  },
];
