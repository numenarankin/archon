"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  XIcon,
  FileTextIcon,
  ImageIcon,
  AudioLinesIcon,
  StickyNoteIcon,
  LinkIcon,
  FileIcon,
  FolderIcon,
  ChevronRightIcon,
  ActivityIcon,
  ShapesIcon,
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
import type { RepoFile, RepoFolder } from "@/lib/kb/types";
import type { KBFile, KBFileType } from "@/lib/kb/types";

const TYPE_ICON: Record<KBFileType, LucideIcon> = {
  pdf: FileTextIcon,
  doc: FileTextIcon,
  md: FileTextIcon,
  transcript: AudioLinesIcon,
  note: StickyNoteIcon,
  url: LinkIcon,
  image: ImageIcon,
  las: ActivityIcon,
  diagram: ShapesIcon,
};

/** Flatten the whole repo so selected ids can be resolved to files. */
function collectFiles(folder: RepoFolder): RepoFile[] {
  return [...folder.files, ...folder.folders.flatMap(collectFiles)];
}

const EMPTY_ROOT: RepoFolder = {
  id: "root",
  name: "Files",
  modified: "",
  folders: [],
  files: [],
};

interface AddFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Root of the real file tree to browse. Empty tree if omitted. */
  root?: RepoFolder;
  /** Ids already in the project — shown as "Added" and not selectable. */
  existingIds: Set<string>;
  onAdd: (files: KBFile[]) => void;
}

export function AddFileDialog({
  open,
  onOpenChange,
  root,
  existingIds,
  onAdd,
}: AddFileDialogProps) {
  const tree = root ?? EMPTY_ROOT;
  // Breadcrumb trail of folders, starting at the repo root.
  const [path, setPath] = useState<RepoFolder[]>([tree]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const current = path[path.length - 1];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    const all = collectFiles(tree);
    onAdd(all.filter((f) => selected.has(f.id)));
    onOpenChange(false);
  }

  // Reset navigation + selection each time the dialog opens.
  function handleOpenChange(next: boolean) {
    if (next) {
      setPath([tree]);
      setSelected(new Set());
    }
    onOpenChange(next);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "flex h-[68vh] max-h-[560px] w-[92vw] max-w-[920px] flex-col",
            "overflow-hidden rounded-xl border border-border bg-background-surface shadow-xl",
            "transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          )}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
            <div>
              <Dialog.Title className="ty-body-1 font-semibold text-primary-text">
                Add files
              </Dialog.Title>
              <Dialog.Description className="ty-caption text-tertiary-text">
                Browse the knowledge base and select files to add to this
                project.
              </Dialog.Description>
            </div>
            <Dialog.Close
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Close" />
              }
            >
              <XIcon />
            </Dialog.Close>
          </header>

          {/* Breadcrumb */}
          <nav className="flex shrink-0 items-center gap-1 border-b border-border px-5 py-2">
            {path.map((folder, i) => {
              const isLast = i === path.length - 1;
              return (
                <span key={folder.id} className="flex items-center gap-1">
                  {i > 0 && (
                    <ChevronRightIcon className="size-3.5 text-tertiary-text" />
                  )}
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={() => setPath(path.slice(0, i + 1))}
                    className={cn(
                      "ty-body-2 rounded px-1.5 py-0.5",
                      isLast
                        ? "font-medium text-primary-text"
                        : "text-tertiary-text hover:bg-background-hover hover:text-primary-text"
                    )}
                  >
                    {folder.name}
                  </button>
                </span>
              );
            })}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background-surface">
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Name</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-24">Size</TableHead>
                  <TableHead className="w-32">Modified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {current.folders.map((folder) => (
                  <TableRow
                    key={folder.id}
                    onClick={() => setPath([...path, folder])}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <ChevronRightIcon className="size-4 text-tertiary-text" />
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium text-primary-text">
                        <FolderIcon className="size-4 shrink-0 text-data-accent" />
                        {folder.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-tertiary-text">Folder</TableCell>
                    <TableCell className="text-tertiary-text">—</TableCell>
                    <TableCell className="text-tertiary-text">
                      {folder.modified || "—"}
                    </TableCell>
                  </TableRow>
                ))}

                {current.files.map((file) => {
                  const added = existingIds.has(file.id);
                  const isSelected = selected.has(file.id);
                  const Icon = TYPE_ICON[file.type] ?? FileIcon;
                  return (
                    <TableRow
                      key={file.id}
                      onClick={() => !added && toggle(file.id)}
                      className={cn(
                        "cursor-pointer",
                        added && "cursor-default opacity-50",
                        isSelected && "bg-data-accent/10"
                      )}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={added || isSelected}
                          disabled={added}
                          onChange={() => toggle(file.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${file.name}`}
                          className="size-4 accent-neutral-900"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2 text-primary-text">
                          <Icon className="size-4 shrink-0 text-tertiary-text" />
                          {file.name}
                          {added && (
                            <span className="ty-caption rounded bg-background-subtle px-1.5 py-0.5 text-tertiary-text">
                              Added
                            </span>
                          )}
                        </span>
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
                    </TableRow>
                  );
                })}

                {current.folders.length === 0 &&
                  current.files.length === 0 && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-tertiary-text"
                      >
                        This folder is empty.
                      </TableCell>
                    </TableRow>
                  )}
              </TableBody>
            </Table>
          </div>

          <footer className="flex shrink-0 items-center justify-between border-t border-border px-5 py-3">
            <span className="ty-body-2 text-tertiary-text">
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2">
              <Dialog.Close
                render={<Button variant="outline" size="sm">Cancel</Button>}
              />
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={selected.size === 0}
              >
                Add {selected.size > 0 ? selected.size : ""} file
                {selected.size === 1 ? "" : "s"}
              </Button>
            </div>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
