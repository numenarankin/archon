"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import { cn } from "@/lib/utils";
import {
  SKILL_CATEGORIES,
  type ArchonSkill,
  type SkillCategory,
} from "@/lib/archon/skills";
import {
  createCustomSkill,
  deleteCustomSkill,
  updateCustomSkill,
} from "@/lib/archon/actions";

interface SkillModalProps {
  skill: ArchonSkill | null;
  /** Open in "create" mode to add a new custom skill (skill stays null). */
  creating?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * View, edit, or create an Archon skill. Built-in skills are read-only (the
 * catalog is fixed); custom skills the team created can be edited or removed,
 * and create mode adds a new one. Mounted fresh per open (see SkillsSection) so
 * the fields initialise from the selected skill instead of going stale.
 */
export function SkillModal({
  skill,
  creating = false,
  onClose,
  onSaved,
}: SkillModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(skill?.name ?? "");
  const [category, setCategory] = useState<SkillCategory>(
    skill?.category ?? "Data"
  );
  const [description, setDescription] = useState(skill?.description ?? "");
  const [examples, setExamples] = useState((skill?.examples ?? []).join("\n"));

  if (!skill && !creating) return null;

  // Create mode and custom skills are editable; built-in skills are read-only.
  const editable = creating || (skill ? !skill.builtIn : false);

  function save() {
    if (!editable) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    const input = {
      name: trimmed,
      description: description.trim(),
      category,
      examples: examples
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    };
    startTransition(async () => {
      try {
        if (creating) {
          await createCustomSkill(input);
        } else if (skill) {
          await updateCustomSkill(skill.id, input);
        }
        onSaved();
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't save the skill."
        );
      }
    });
  }

  function remove() {
    if (!skill || !editable || creating) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteCustomSkill(skill.id);
        onSaved();
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't remove the skill."
        );
      }
    });
  }

  return (
    <SwipeUpModal
      open={Boolean(skill) || creating}
      onClose={onClose}
      title={creating ? "Add skill" : editable ? "Edit skill" : skill?.name ?? ""}
      description={
        creating
          ? "Describe what this skill does and when Archon should use it."
          : editable
            ? "Update what this skill does and when Archon should use it."
            : "Built-in skill, always on and not editable."
      }
    >
      <div className="flex flex-col gap-4 px-5 py-5">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {editable ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Name
              </span>
              <Input
                className="h-10"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lease Compliance Checks"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Category
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as SkillCategory)}
                className="h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {SKILL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Description
              </span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What can Archon do with this skill, and when should it use it?"
                className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Example prompts{" "}
                <span className="font-normal text-muted-foreground/70">
                  (one per line)
                </span>
              </span>
              <textarea
                rows={3}
                value={examples}
                onChange={(e) => setExamples(e.target.value)}
                placeholder={
                  "Which leases expire this year?\nFlag wells missing a permit."
                }
                className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </label>

            <div
              className={cn(
                "mt-2 flex items-center gap-2",
                creating ? "justify-end" : "justify-between"
              )}
            >
              {!creating && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={remove}
                >
                  <Trash2Icon className="size-4" />
                  Remove
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={pending}
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="lg"
                  disabled={pending || !name.trim()}
                  onClick={save}
                >
                  {pending && <Loader2Icon className="size-4 animate-spin" />}
                  {creating ? "Add skill" : "Save"}
                </Button>
              </div>
            </div>
          </>
        ) : skill ? (
          <SkillView skill={skill} onClose={onClose} />
        ) : null}
      </div>
    </SwipeUpModal>
  );
}

/** Read-only details for a built-in skill. */
function SkillView({
  skill,
  onClose,
}: {
  skill: ArchonSkill;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge>{skill.category}</Badge>
        <Badge>Built-in</Badge>
        {skill.requiresApproval && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <ShieldCheckIcon className="size-3" />
            Approval
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{skill.description}</p>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Tools</span>
        <div className="flex flex-wrap items-center gap-1">
          {skill.tools.map((tool) => (
            <span
              key={tool}
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
            >
              {tool}
            </span>
          ))}
        </div>
      </div>

      {skill.examples.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-3">
          <span className="text-xs font-medium text-muted-foreground">
            Example prompts
          </span>
          {skill.examples.map((example) => (
            <p key={example} className="text-xs text-muted-foreground">
              &ldquo;{example}&rdquo;
            </p>
          ))}
        </div>
      )}

      <div className="mt-2 flex justify-end">
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          Close
        </Button>
      </div>
    </>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}
