import { notFound } from "next/navigation";
import { getProjectBySlug } from "@/lib/projects/folders";
import { getFolderTree } from "@/lib/kb/files";
import { getTasks } from "@/lib/tasks/tasks";
import { getContractors } from "@/lib/people/people";
import { ProjectWorkspace } from "@/components/projects/project-workspace";
import type { RepoFolder } from "@/lib/kb/types";

export default async function ProjectFolderPage({
  params,
}: {
  params: Promise<{ folder: string }>;
}) {
  const { folder: slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const [projectTree, tasks, contractors] = await Promise.all([
    getFolderTree(project.id),
    getTasks(project.id),
    getContractors(),
  ]);

  // Fall back to an empty subtree if the folder row can't be resolved.
  const tree: RepoFolder = projectTree ?? {
    id: project.id,
    name: project.name,
    folders: [],
    files: [],
    modified: "",
  };

  // Assignable people: the current user plus every contractor (same as /tasks).
  const assignees = ["Me", ...contractors.map((c) => c.name)];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectWorkspace
        folderId={project.id}
        projectName={project.name}
        projectTree={tree}
        tasks={tasks}
        assignees={assignees}
      />
    </div>
  );
}
