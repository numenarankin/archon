import { getProjectFolders } from "@/lib/projects/folders";
import { FolderGrid } from "@/components/projects/folder-grid";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { requirePermission } from "@/lib/auth/permissions";

export default async function ProjectsPage() {
  await requirePermission("view_projects");
  const folders = await getProjectFolders();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Projects
        </h1>
        <NewProjectButton />
      </div>
      <FolderGrid folders={folders} />
    </div>
  );
}
