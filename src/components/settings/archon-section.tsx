"use client";

import { SkillsSection } from "@/components/settings/skills-section";
import { ContextDocEditor } from "@/components/settings/context-doc-editor";
import type { ArchonSkill } from "@/lib/archon/skills";
import type { ContextDoc, ContextDocType } from "@/lib/ai/context/docs";

interface DocMeta {
  type: ContextDocType;
  title: string;
  blurb: string;
  readOnly?: boolean;
}

// Order shown in the editor. Harness/app are user-owned; soul/persona/memory are
// also written by Archon's self-improvement loop; the skills menu is derived.
const DOC_META: DocMeta[] = [
  {
    type: "soul",
    title: "Soul",
    blurb: "Archon's personality, background, and purpose. Archon may refine this from your feedback.",
  },
  {
    type: "persona",
    title: "Persona",
    blurb: "Who you are. Archon updates this as it learns how you work.",
  },
  {
    type: "memory",
    title: "Memory",
    blurb: "What Archon has learned and carries into every chat. Updated automatically after each turn.",
  },
  {
    type: "harness",
    title: "Harness",
    blurb: "Safety and behavior constraints. You can edit these; Archon's self-improvement loop never changes them.",
  },
  {
    type: "app",
    title: "App",
    blurb: "What this app is and how its data is organized. The live tool list is appended automatically.",
  },
  {
    type: "skills",
    title: "Skills menu",
    blurb: "The condensed menu Archon routes from. Generated from your skills, not edited directly.",
    readOnly: true,
  },
];

/**
 * The AI settings tab: the skills table (with create/edit) on top, then the six
 * editable context documents that define how Archon thinks and improves.
 */
export function ArchonSection({
  customSkills,
  docs,
}: {
  customSkills: ArchonSkill[];
  docs: ContextDoc[];
}) {
  const byType = new Map(docs.map((d) => [d.docType, d]));

  return (
    <div className="flex flex-col gap-10">
      <SkillsSection customSkills={customSkills} />

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          System prompts
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The documents that define how Archon thinks, what it knows about you,
          and the guardrails it operates under. Archon improves Soul, Persona,
          and Memory on its own as you work; every change is versioned and can be
          rolled back from each document&apos;s history.
        </p>

        <div className="flex flex-col gap-4">
          {DOC_META.map((m) => {
            const d = byType.get(m.type);
            return (
              <ContextDocEditor
                key={m.type}
                docType={m.type}
                title={m.title}
                blurb={m.blurb}
                initialContent={d?.content ?? ""}
                version={d?.version ?? 1}
                updatedBy={d?.updatedBy ?? "system"}
                readOnly={m.readOnly}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
