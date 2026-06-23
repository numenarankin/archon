"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slug";
import { FileBrowser } from "@/components/files/file-browser";
import { KnowledgeGraphView } from "@/components/kb/knowledge-graph-view";
import { ProjectBudgetTable } from "@/components/projects/project-budget-table";
import { TasksBoard } from "@/components/tasks/tasks-board";
import { SetPageBreadcrumb } from "@/components/breadcrumb-context";
import { useProjectScope } from "@/lib/ai/use-project-scope";
import { renameFolder } from "@/lib/files/actions";
import type { RepoFolder } from "@/lib/kb/types";
import type { Task } from "@/lib/tasks/tasks";

type ProjectTab = "tasks" | "files" | "knowledge-graph" | "budget";

const TABS: { value: ProjectTab; label: string }[] = [
  { value: "tasks", label: "Tasks" },
  { value: "files", label: "Folders" },
  { value: "knowledge-graph", label: "Graph" },
  { value: "budget", label: "Budget" },
];

// Horizontal padding that lines content up with the topbar page label (matches
// AppMain's padded routes; the project route itself is full-bleed).
const GUTTER = "px-[77px] md:px-[85px]";

interface ProjectWorkspaceProps {
  folderId: string;
  projectName: string;
  /** The project's folder subtree, for the scoped file browser. */
  projectTree: RepoFolder;
  tasks: Task[];
  assignees: string[];
}

/**
 * The project detail page: a top menu (Tasks · Files · Budget) over three
 * surfaces. Files is the same browser as /files, scoped to this project's
 * folder, with Archon in the global drawer (project-scoped while this page is
 * mounted). Tasks is the project-scoped kanban board; Budget is a view over the
 * project's budgeted tasks.
 */
export function ProjectWorkspace({
  folderId,
  projectName,
  projectTree,
  tasks,
  assignees,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<ProjectTab>("tasks");
  const setScope = useProjectScope((s) => s.setScope);

  // Scope the Archon drawer to this project while the page is open.
  useEffect(() => {
    setScope({ folderId, projectName });
    return () => setScope(null);
  }, [folderId, projectName, setScope]);

  const budgetTasks = useMemo(
    () => tasks.filter((t) => t.budget != null),
    [tasks]
  );

  function handleRenameProject(newName: string) {
    startTransition(async () => {
      try {
        await renameFolder(folderId, newName);
        router.replace(`/projects/${slugify(newName)}`);
      } catch (error) {
        console.error("Failed to rename project", error);
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Project name in the topbar breadcrumb; click it there to rename. */}
      <SetPageBreadcrumb label={projectName} onRename={handleRenameProject} />

      <div className={cn("shrink-0 py-4 md:py-6", GUTTER)}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "font-heading text-2xl font-semibold tracking-tight transition-colors",
                tab === t.value
                  ? "text-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "tasks" && (
        <div className={cn("flex min-h-0 flex-1 flex-col pb-4 md:pb-6", GUTTER)}>
          <TasksBoard
            tasks={tasks}
            assignees={assignees}
            folderId={folderId}
            embedded
          />
        </div>
      )}

      {tab === "files" && (
        <div className={cn("flex min-h-0 flex-1 flex-col pb-4 md:pb-6", GUTTER)}>
          <FileBrowser root={projectTree} />
        </div>
      )}

      {tab === "knowledge-graph" && (
        <div className={cn("flex min-h-0 flex-1 flex-col pb-4 md:pb-6", GUTTER)}>
          <KnowledgeGraphView folderId={folderId} />
        </div>
      )}

      {tab === "budget" && (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto pb-4 md:pb-6",
            GUTTER
          )}
        >
          <ProjectBudgetTable tasks={budgetTasks} />
        </div>
      )}
    </div>
  );
}
