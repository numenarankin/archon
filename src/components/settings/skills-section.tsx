"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ARCHON_SKILLS, type ArchonSkill } from "@/lib/archon/skills";
import { setSkillEnabled } from "@/lib/archon/actions";
import { SkillModal } from "@/components/settings/skill-modal";

/**
 * Skills table for the AI settings tab, in the payment-methods table layout.
 * Built-in skills are always on; custom skills carry their own enabled state.
 * Selecting a row opens the skill modal to view (built-in) or edit (custom) it,
 * and "New skill" opens it in create mode.
 */
export function SkillsSection({
  customSkills,
}: {
  customSkills: ArchonSkill[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Custom skills come from the server; keep a local copy for optimistic
  // toggling and re-sync (during render) when the server prop changes after a
  // mutation refresh.
  const [custom, setCustom] = useState<ArchonSkill[]>(customSkills);
  const [syncedSkills, setSyncedSkills] = useState(customSkills);
  if (syncedSkills !== customSkills) {
    setSyncedSkills(customSkills);
    setCustom(customSkills);
  }

  const [viewing, setViewing] = useState<ArchonSkill | null>(null);
  const [creating, setCreating] = useState(false);

  const allSkills = useMemo(() => [...custom, ...ARCHON_SKILLS], [custom]);

  const isEnabled = (skill: ArchonSkill) =>
    skill.builtIn || skill.enabledByDefault;

  function toggle(skill: ArchonSkill) {
    // Built-in skills can't be disabled (their switch is rendered locked).
    if (skill.builtIn) return;
    const next = !skill.enabledByDefault;
    setCustom((prev) =>
      prev.map((s) => (s.id === skill.id ? { ...s, enabledByDefault: next } : s))
    );
    startTransition(async () => {
      try {
        await setSkillEnabled(skill.id, next);
        router.refresh();
      } catch (error) {
        console.error("Failed to toggle skill", error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Skills
        </h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          <PlusIcon className="size-4" />
          New skill
        </Button>
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">
        Capabilities Archon draws on across the company&apos;s data. Built-in
        skills are always on. Toggle your custom skills to control what the
        assistant may do, and select any skill to view or edit it.
      </p>

      <div className="overflow-hidden rounded-[0.1rem] border">
        <Table className="text-[0.95rem]">
          <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Skill</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allSkills.map((skill) => {
              const enabled = isEnabled(skill);
              return (
                <TableRow
                  key={skill.id}
                  className="cursor-pointer [&>td]:py-4"
                  onClick={() => setViewing(skill)}
                >
                  <TableCell className="font-medium">{skill.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {skill.category}
                  </TableCell>
                  <TableCell>
                    {skill.builtIn ? (
                      <span className="text-muted-foreground/50">Built-in</span>
                    ) : (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Custom
                      </span>
                    )}
                  </TableCell>
                  {/* Toggling shouldn't open the modal. */}
                  <TableCell
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-end">
                      <Switch
                        checked={enabled}
                        disabled={skill.builtIn}
                        onCheckedChange={() => toggle(skill)}
                        aria-label={
                          skill.builtIn
                            ? `${skill.name} is a built-in skill and always on`
                            : `${enabled ? "Disable" : "Enable"} ${skill.name}`
                        }
                        title={
                          skill.builtIn ? "Built-in skill — always on" : undefined
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {(viewing || creating) && (
        <SkillModal
          key={viewing?.id ?? "new"}
          skill={viewing}
          creating={creating}
          onClose={() => {
            setViewing(null);
            setCreating(false);
          }}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
