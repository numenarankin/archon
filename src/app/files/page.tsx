import { getFilesRoot } from "@/lib/kb/files";
import { FileBrowser } from "@/components/files/file-browser";
import { requirePermission } from "@/lib/auth/permissions";

export default async function FilesPage() {
  await requirePermission("manage_files");
  const root = await getFilesRoot();

  return <FileBrowser root={root} />;
}
