"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileTextIcon,
  ImageIcon,
  AudioLinesIcon,
  StickyNoteIcon,
  LinkIcon,
  FileIcon,
  ActivityIcon,
  FolderIcon,
  FolderPlusIcon,
  FilePlusIcon,
  ChevronRightIcon,
  UploadIcon,
  Loader2Icon,
  DownloadIcon,
  PencilIcon,
  PinIcon,
  FolderInputIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DocumentViewer } from "@/components/files/document-viewer";
import { DocumentEditor } from "@/components/files/document-editor";
import { useAiDrawer } from "@/lib/ai/use-ai-drawer";
import { useAiContext } from "@/lib/ai/use-ai-context";
import {
  createDoc,
  createFolder,
  getDownloadUrl,
  moveFile,
  renameFile,
  setPin,
  uploadFiles,
} from "@/lib/files/actions";
import { MoveToFolderDialog } from "@/components/files/move-to-folder-dialog";
import type { RepoFile, RepoFolder } from "@/lib/kb/types";
import type { KBFileType } from "@/lib/kb/types";

const TYPE_ICON: Record<KBFileType, LucideIcon> = {
  pdf: FileTextIcon,
  doc: FileTextIcon,
  md: FileTextIcon,
  transcript: AudioLinesIcon,
  note: StickyNoteIcon,
  url: LinkIcon,
  image: ImageIcon,
  las: ActivityIcon,
};

interface FileBrowserProps {
  root: RepoFolder;
}

/** Depth-first lookup of a folder by id within the tree. */
function findFolder(node: RepoFolder, id: string): RepoFolder | null {
  if (node.id === id) return node;
  for (const child of node.folders) {
    const found = findFolder(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Drive-style file browser, backed by Supabase. Navigates by folder id so it
 * survives the route refresh after every mutation (upload / rename / pin /
 * new folder). Pinned files float to the top of their folder.
 */
export function FileBrowser({ root }: FileBrowserProps) {
  const router = useRouter();
  const [pathIds, setPathIds] = useState<string[]>([root.id]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");
  const [viewing, setViewing] = useState<RepoFile | null>(null);
  const [movingFile, setMovingFile] = useState<RepoFile | null>(null);
  const [, startTransition] = useTransition();
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openDrawer = useAiDrawer((s) => s.setOpen);
  const setAiSelection = useAiContext((s) => s.setSelection);
  const skipBlurCommit = useRef(false);

  // Resolve the breadcrumb path and current folder from the (possibly
  // refreshed) tree. Ids that no longer exist fall back to the root.
  const pathFolders = pathIds
    .map((id) => findFolder(root, id))
    .filter((f): f is RepoFolder => f !== null);
  const path = pathFolders.length > 0 ? pathFolders : [root];
  const current = path[path.length - 1];

  // Keep the Archon drawer aware of the active file (when viewing one) or the
  // folder being browsed. Cleared when the browser unmounts.
  useEffect(() => {
    setAiSelection(
      viewing
        ? {
            kind: "file",
            id: viewing.id,
            name: viewing.name,
            fileType: viewing.type,
          }
        : { kind: "folder", id: current.id, name: current.name }
    );
  }, [viewing, current.id, current.name, setAiSelection]);

  useEffect(() => () => setAiSelection(null), [setAiSelection]);

  function openDocument(file: RepoFile) {
    setViewing(file);
    openDrawer(true);
  }

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;
    const formData = new FormData();
    selected.forEach((file) => formData.append("files", file));
    setUploadingNames(selected.map((f) => f.name));
    startTransition(async () => {
      try {
        await uploadFiles(current.id, formData);
        router.refresh();
      } catch (error) {
        console.error("Upload failed", error);
      } finally {
        setUploadingNames([]);
      }
    });
  }

  function handleCreateDoc() {
    startTransition(async () => {
      try {
        const { id } = await createDoc(current.id);
        router.refresh();
        // Open the new doc straight into the editor.
        setViewing({
          id,
          name: "Untitled.md",
          path: "Untitled.md",
          type: "md",
          folder_id: current.id,
          size: "",
          modified: "",
          pinned: false,
        });
      } catch (error) {
        console.error("Failed to create doc", error);
      }
    });
  }

  function handleCreateFolder() {
    const name = folderDraft.trim();
    setCreatingFolder(false);
    setFolderDraft("");
    if (!name) return;
    startTransition(async () => {
      try {
        await createFolder(current.id, name);
        router.refresh();
      } catch (error) {
        console.error("Failed to create folder", error);
      }
    });
  }

  function startRename(file: RepoFile) {
    setEditingId(file.id);
    setDraft(file.name);
  }

  function commitRename() {
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false;
      return;
    }
    const id = editingId;
    const trimmed = draft.trim();
    setEditingId(null);
    if (!id || !trimmed) return;
    startTransition(async () => {
      try {
        await renameFile(id, trimmed);
        router.refresh();
      } catch (error) {
        console.error("Rename failed", error);
      }
    });
  }

  function cancelRename() {
    skipBlurCommit.current = true;
    setEditingId(null);
  }

  function togglePin(file: RepoFile) {
    startTransition(async () => {
      try {
        await setPin(file.id, current.id, !file.pinned);
        router.refresh();
      } catch (error) {
        console.error("Pin failed", error);
      }
    });
  }

  function handleMove(file: RepoFile, targetFolderId: string) {
    startTransition(async () => {
      try {
        await moveFile(file.id, current.id, targetFolderId);
        router.refresh();
      } catch (error) {
        console.error("Move failed", error);
      }
    });
  }

  async function handleDownload(file: RepoFile) {
    try {
      const url = await getDownloadUrl(file.id);
      if (url) {
        window.open(url, "_blank");
        return;
      }
    } catch (error) {
      console.error("Download failed", error);
    }
    // Inline-only docs (no stored bytes): fall back to a text placeholder.
    const blob = new Blob([`No stored file for ${file.name}`], {
      type: "text/plain",
    });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  const folders = current.folders;
  const files = current.files;
  const isEmpty =
    folders.length === 0 && files.length === 0 && !creatingFolder;

  if (viewing) {
    // Inline docs (markdown / notes) are editable; everything else previews.
    const editable = viewing.type === "md" || viewing.type === "note";
    return editable ? (
      <DocumentEditor file={viewing} onBack={() => setViewing(null)} />
    ) : (
      <DocumentViewer
        file={viewing}
        name={viewing.name}
        onBack={() => setViewing(null)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Header: breadcrumbs + actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav className="flex flex-wrap items-center gap-1">
          {path.map((folder, i) => {
            const isLast = i === path.length - 1;
            return (
              <span key={folder.id} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRightIcon className="size-5 text-tertiary-text" />
                )}
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => setPathIds(pathIds.slice(0, i + 1))}
                  className={cn(
                    "rounded px-1.5 py-0.5 font-heading text-2xl font-semibold tracking-tight",
                    isLast
                      ? "text-primary-text"
                      : "text-tertiary-text hover:bg-background-hover hover:text-primary-text"
                  )}
                >
                  {folder.name}
                </button>
              </span>
            );
          })}
        </nav>

        {/*
          TODO: Special handling for PDFs and image file formats (png, jpg,
          etc.). On upload, run the document through OCR to extract its data,
          then save a JSON or Markdown version of the doc. Store that derived
          file's name in the original upload's metadata so Archon (our AI agent)
          can read the JSON/Markdown representation instead of the raw file —
          Archon is poor at reading PDFs and images directly.
        */}
        <div className="flex items-center gap-2">
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              setFolderDraft("");
              setCreatingFolder(true);
            }}
          >
            <FolderPlusIcon />
            New Folder
          </Button>
          <Button size="lg" variant="outline" onClick={handleCreateDoc}>
            <FilePlusIcon />
            New Doc
          </Button>
          <Button
            size="lg"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingNames.length > 0}
            className="bg-black text-white hover:bg-neutral-800"
          >
            {uploadingNames.length > 0 ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <UploadIcon />
            )}
            {uploadingNames.length > 0 ? "Uploading…" : "Upload File"}
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {/* File table (borderless) */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Name</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="w-24">Size</TableHead>
              <TableHead className="w-32">Modified</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {uploadingNames.map((name, i) => (
              <TableRow key={`uploading-${i}`} className="hover:bg-transparent">
                <TableCell>
                  <Loader2Icon className="size-4 animate-spin text-tertiary-text" />
                </TableCell>
                <TableCell>
                  <span className="text-primary-text">{name}</span>
                </TableCell>
                <TableCell colSpan={4} className="text-tertiary-text">
                  Uploading &amp; indexing…
                </TableCell>
              </TableRow>
            ))}
            {creatingFolder && (
              <TableRow className="hover:bg-transparent">
                <TableCell>
                  <FolderIcon
                    className="size-4 text-data-accent"
                    fill="currentColor"
                  />
                </TableCell>
                <TableCell>
                  <input
                    autoFocus
                    value={folderDraft}
                    placeholder="Folder name"
                    onChange={(e) => setFolderDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateFolder();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setCreatingFolder(false);
                        setFolderDraft("");
                      }
                    }}
                    onBlur={handleCreateFolder}
                    className="w-full max-w-[280px] rounded border border-border bg-background px-1.5 py-0.5 text-primary-text outline-none focus:ring-1 focus:ring-ring"
                  />
                </TableCell>
                <TableCell className="text-tertiary-text">Folder</TableCell>
                <TableCell className="text-tertiary-text">—</TableCell>
                <TableCell className="text-tertiary-text">—</TableCell>
                <TableCell />
              </TableRow>
            )}

            {folders.map((folder) => (
              <TableRow
                key={folder.id}
                onClick={() => setPathIds([...pathIds, folder.id])}
                className="cursor-pointer"
              >
                <TableCell>
                  <FolderIcon
                    className="size-4 text-data-accent"
                    fill="currentColor"
                  />
                </TableCell>
                <TableCell>
                  <span className="font-medium text-primary-text">
                    {folder.name}
                  </span>
                </TableCell>
                <TableCell className="text-tertiary-text">Folder</TableCell>
                <TableCell className="text-tertiary-text">—</TableCell>
                <TableCell className="text-tertiary-text">
                  {folder.modified || "—"}
                </TableCell>
                <TableCell />
              </TableRow>
            ))}

            {files.map((file) => {
              const Icon = TYPE_ICON[file.type] ?? FileIcon;
              const isPinned = file.pinned ?? false;
              return (
                <TableRow
                  key={file.id}
                  className="group/row cursor-pointer"
                  onClick={() => {
                    if (editingId !== file.id) openDocument(file);
                  }}
                >
                  <TableCell>
                    <Icon className="size-4 text-tertiary-text" />
                  </TableCell>
                  <TableCell>
                    {editingId === file.id ? (
                      <input
                        autoFocus
                        value={draft}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setDraft(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitRename();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                        onBlur={commitRename}
                        className="w-full max-w-[280px] rounded border border-border bg-background px-1.5 py-0.5 text-primary-text outline-none focus:ring-1 focus:ring-ring"
                      />
                    ) : (
                      <span className="flex items-center gap-1.5 text-primary-text">
                        {file.name}
                        {isPinned && (
                          <PinIcon className="size-3.5 fill-current text-data-accent" />
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="uppercase text-tertiary-text">
                    {file.type}
                  </TableCell>
                  <TableCell className="text-tertiary-text">
                    {file.size}
                  </TableCell>
                  <TableCell className="text-tertiary-text">
                    {file.modified}
                  </TableCell>
                  <TableCell>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "flex items-center justify-end gap-0.5 transition-opacity",
                        "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100"
                      )}
                    >
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Download"
                        onClick={() => handleDownload(file)}
                      >
                        <DownloadIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move to folder"
                        onClick={() => setMovingFile(file)}
                      >
                        <FolderInputIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Rename"
                        onClick={() => startRename(file)}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={isPinned ? "Unpin" : "Pin"}
                        onClick={() => togglePin(file)}
                        className={cn(isPinned && "text-data-accent")}
                      >
                        <PinIcon className={cn(isPinned && "fill-current")} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}

            {isEmpty && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-tertiary-text"
                >
                  This folder is empty.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {movingFile && (
        <MoveToFolderDialog
          open={movingFile !== null}
          onOpenChange={(o) => {
            if (!o) setMovingFile(null);
          }}
          root={root}
          currentFolderId={current.id}
          fileName={movingFile.name}
          onMove={(target) => handleMove(movingFile, target)}
        />
      )}
    </div>
  );
}
