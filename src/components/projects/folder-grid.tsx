import type { ProjectFolder } from "@/lib/projects/folders";
import { FolderItem } from "@/components/projects/folder-item";

interface FolderGridProps {
  folders: ProjectFolder[];
}

export function FolderGrid({ folders }: FolderGridProps) {
  if (folders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No folders to display.</p>
    );
  }

  return (
    <div className="-mx-3 grid grid-cols-2 gap-2 md:grid-cols-4">
      {folders.map((folder) => (
        <FolderItem key={folder.id} folder={folder} />
      ))}
    </div>
  );
}
