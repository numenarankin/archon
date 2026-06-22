"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  FolderIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { RepoFolder } from "@/lib/kb/types";

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Root of the folder tree. */
  root: RepoFolder;
  /** The file's current folder — disabled as a destination. */
  currentFolderId: string;
  /** Name of the file being moved (for the header). */
  fileName: string;
  onMove: (targetFolderId: string) => void;
}

function FolderNode({
  folder,
  depth,
  expanded,
  onToggle,
  selectedId,
  onSelect,
  disabledId,
}: {
  folder: RepoFolder;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabledId: string;
}) {
  const isExpanded = expanded.has(folder.id);
  const hasChildren = folder.folders.length > 0;
  const isSelected = selectedId === folder.id;
  const isDisabled = folder.id === disabledId;

  return (
    <div>
      <div
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        onClick={() => !isDisabled && onSelect(folder.id)}
        style={{ paddingLeft: depth * 16 + 6 }}
        className={cn(
          "flex items-center gap-1 rounded py-1 pr-2",
          isDisabled
            ? "cursor-not-allowed opacity-40"
            : "cursor-pointer",
          isSelected
            ? "bg-data-accent/15 text-primary-text"
            : !isDisabled && "hover:bg-background-subtle/60"
        )}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(folder.id);
          }}
          aria-label={isExpanded ? "Collapse" : "Expand"}
          className={cn(
            "flex size-4 items-center justify-center text-tertiary-text",
            !hasChildren && "invisible"
          )}
        >
          {isExpanded ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronRightIcon className="size-3.5" />
          )}
        </button>
        <FolderIcon className="size-4 text-data-accent" fill="currentColor" />
        <span className="ty-body-2 truncate text-primary-text">
          {folder.name}
        </span>
      </div>
      {isExpanded &&
        folder.folders.map((child) => (
          <FolderNode
            key={child.id}
            folder={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            selectedId={selectedId}
            onSelect={onSelect}
            disabledId={disabledId}
          />
        ))}
    </div>
  );
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  root,
  currentFolderId,
  fileName,
  onMove,
}: MoveToFolderDialogProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([root.id]));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reset selection each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setExpanded(new Set([root.id]));
    }
  }, [open, root.id]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleMove() {
    if (!selectedId || selectedId === currentFolderId) return;
    onMove(selectedId);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "flex max-h-[80vh] w-[92vw] max-w-[460px] flex-col",
            "overflow-hidden rounded-xl border border-border bg-background-surface shadow-xl",
            "transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
          )}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
            <Dialog.Title className="ty-body-1 font-semibold text-primary-text">
              Move “{fileName}”
            </Dialog.Title>
            <Dialog.Close
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Close" />
              }
            >
              <XIcon />
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <FolderNode
              folder={root}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              selectedId={selectedId}
              onSelect={setSelectedId}
              disabledId={currentFolderId}
            />
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
            <Dialog.Close
              render={<Button variant="outline" size="sm">Cancel</Button>}
            />
            <Button
              size="sm"
              onClick={handleMove}
              disabled={!selectedId || selectedId === currentFolderId}
            >
              Move here
            </Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
