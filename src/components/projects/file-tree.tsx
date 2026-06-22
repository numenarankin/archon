"use client";

import {
  ActivityIcon,
  AudioLinesIcon,
  ChevronRightIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  ImageIcon,
  LinkIcon,
  StickyNoteIcon,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useDrag, useDrop } from "react-dnd";
import { cn } from "@/lib/utils";
import { useKBStore } from "@/lib/kb/store";
import type {
  KBFile,
  KBFileType,
  KBTreeNode,
} from "@/lib/kb/types";

const FILE_ICONS: Record<KBFileType, ReactNode> = {
  pdf: <FileTextIcon className="h-3.5 w-3.5 text-error/80" />,
  doc: <FileTextIcon className="h-3.5 w-3.5 text-secondary-text" />,
  md: <FileTextIcon className="h-3.5 w-3.5 text-data-accent/80" />,
  transcript: <AudioLinesIcon className="h-3.5 w-3.5 text-info/80" />,
  note: <StickyNoteIcon className="h-3.5 w-3.5 text-warning/80" />,
  url: <LinkIcon className="h-3.5 w-3.5 text-secondary-text" />,
  image: <ImageIcon className="h-3.5 w-3.5 text-success/80" />,
  las: <ActivityIcon className="h-3.5 w-3.5 text-data-accent/80" />,
};

const KB_FILE_DND = "kb-file";
const KB_FOLDER_DND = "kb-folder";

interface FileDragItem {
  id: string;
  /** Current folder_id of the file — used to no-op same-folder drops. */
  folder_id: string;
}

interface FolderDragItem {
  id: string;
}

export type KBMoveSource =
  | { type: "file"; id: string }
  | { type: "folder"; id: string };

interface FileTreeProps {
  nodes: KBTreeNode[];
  /**
   * Files at the repo root (folder_id === ""). Rendered above the folder
   * nodes so they aren't dropped — they don't belong to any folder so
   * buildTree wouldn't include them otherwise.
   */
  rootFiles?: KBFile[];
  selectedFileId: string | null;
  onSelectFile: (file: KBFile) => void;
  /** Drag-and-drop move callback. destFolderPath="" means the repo root. */
  onMove?: (source: KBMoveSource, destFolderPath: string) => void;
  /**
   * Inline new-folder input. When string (including ""), an editable
   * folder row renders at the bottom of the tree with this value. When
   * null, nothing is rendered.
   */
  editingFolderName?: string | null;
  onEditingFolderNameChange?: (name: string) => void;
  onEditingFolderCommit?: () => void;
  onEditingFolderCancel?: () => void;
}

export function FileTree({
  nodes,
  rootFiles,
  selectedFileId,
  onSelectFile,
  onMove,
  editingFolderName,
  onEditingFolderNameChange,
  onEditingFolderCommit,
  onEditingFolderCancel,
}: FileTreeProps) {
  return (
    <ul className="flex flex-col">
      {rootFiles?.map((file) => (
        <FileRow
          key={file.id}
          file={file}
          level={0}
          selected={file.id === selectedFileId}
          onSelect={() => onSelectFile(file)}
          onMove={onMove}
        />
      ))}
      {nodes.map((node) => (
        <TreeNode
          key={node.folder.id}
          node={node}
          level={0}
          selectedFileId={selectedFileId}
          onSelectFile={onSelectFile}
          onMove={onMove}
        />
      ))}
      {editingFolderName !== null && editingFolderName !== undefined && (
        <NewFolderRow
          value={editingFolderName}
          onChange={onEditingFolderNameChange ?? noop}
          onCommit={onEditingFolderCommit ?? noop}
          onCancel={onEditingFolderCancel ?? noop}
        />
      )}
    </ul>
  );
}

function noop() {}

interface TreeNodeProps {
  node: KBTreeNode;
  level: number;
  selectedFileId: string | null;
  onSelectFile: (file: KBFile) => void;
  onMove?: (source: KBMoveSource, destFolderPath: string) => void;
}

function TreeNode({
  node,
  level,
  selectedFileId,
  onSelectFile,
  onMove,
}: TreeNodeProps) {
  const expanded = useKBStore((s) => s.expanded[node.folder.id] ?? false);
  const toggleFolder = useKBStore((s) => s.toggleFolder);
  const hasChildren =
    node.subfolders.length > 0 || node.files.length > 0;

  const folderId = node.folder.id;

  const [{ isDragging }, dragRef] = useDrag<
    FolderDragItem,
    unknown,
    { isDragging: boolean }
  >(
    () => ({
      type: KB_FOLDER_DND,
      item: { id: folderId },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [folderId],
  );

  const [{ isOver, canDrop }, dropRef] = useDrop<
    FileDragItem | FolderDragItem,
    unknown,
    { isOver: boolean; canDrop: boolean }
  >(
    () => ({
      accept: [KB_FILE_DND, KB_FOLDER_DND],
      canDrop: (item, monitor) => {
        const type = monitor.getItemType();
        if (type === KB_FOLDER_DND) {
          const src = item as FolderDragItem;
          // No-op for self; cycle for descendant.
          if (src.id === folderId) return false;
          if (folderId === src.id || folderId.startsWith(`${src.id}/`))
            return false;
          return true;
        }
        if (type === KB_FILE_DND) {
          const src = item as FileDragItem;
          return src.folder_id !== folderId;
        }
        return false;
      },
      drop: (item, monitor) => {
        if (monitor.didDrop()) return; // a nested target already handled it
        const type = monitor.getItemType();
        if (type === KB_FOLDER_DND) {
          onMove?.({ type: "folder", id: (item as FolderDragItem).id }, folderId);
        } else if (type === KB_FILE_DND) {
          onMove?.({ type: "file", id: (item as FileDragItem).id }, folderId);
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    }),
    [folderId, onMove],
  );

  const showDropHighlight = isOver && canDrop;

  return (
    <li ref={dropRef as unknown as React.Ref<HTMLLIElement>}>
      <button
        ref={dragRef as unknown as React.Ref<HTMLButtonElement>}
        type="button"
        onClick={() => toggleFolder(folderId)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-[3px] py-1 pr-2 text-left transition-colors hover:bg-background-hover",
          showDropHighlight && "bg-data-accent/15 ring-1 ring-data-accent/40",
          isDragging && "opacity-40",
        )}
        style={{ paddingLeft: `${8 + level * 12}px` }}
      >
        <ChevronRightIcon
          className={cn(
            "h-3 w-3 shrink-0 text-tertiary-text transition-transform",
            expanded && "rotate-90",
            !hasChildren && "opacity-0",
          )}
        />
        {expanded ? (
          <FolderOpenIcon className="h-3.5 w-3.5 shrink-0 text-tertiary-text" />
        ) : (
          <FolderIcon className="h-3.5 w-3.5 shrink-0 text-tertiary-text" />
        )}
        <span className="ty-body-2 truncate text-primary-text">
          {node.folder.name}
        </span>
      </button>
      {expanded && (
        <ul className="flex flex-col">
          {node.subfolders.map((sub) => (
            <TreeNode
              key={sub.folder.id}
              node={sub}
              level={level + 1}
              selectedFileId={selectedFileId}
              onSelectFile={onSelectFile}
              onMove={onMove}
            />
          ))}
          {node.files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              level={level + 1}
              selected={file.id === selectedFileId}
              onSelect={() => onSelectFile(file)}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

interface FileRowProps {
  file: KBFile;
  level: number;
  selected: boolean;
  onSelect: () => void;
  onMove?: (source: KBMoveSource, destFolderPath: string) => void;
}

interface NewFolderRowProps {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

function NewFolderRow({
  value,
  onChange,
  onCommit,
  onCancel,
}: NewFolderRowProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <li>
      <div
        className="flex w-full items-center gap-1.5 rounded-[3px] py-1 pr-2"
        style={{ paddingLeft: "8px" }}
      >
        <ChevronRightIcon className="h-3 w-3 shrink-0 text-tertiary-text opacity-0" />
        <FolderIcon className="h-3.5 w-3.5 shrink-0 text-tertiary-text" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          onBlur={() => onCommit()}
          placeholder="New folder"
          aria-label="New folder name"
          className="ty-body-2 min-w-0 flex-1 bg-transparent text-primary-text outline-none placeholder:text-tertiary-text"
        />
      </div>
    </li>
  );
}

function FileRow({ file, level, selected, onSelect }: FileRowProps) {
  const fileId = file.id;
  const folderId = file.folder_id;

  const [{ isDragging }, dragRef] = useDrag<
    FileDragItem,
    unknown,
    { isDragging: boolean }
  >(
    () => ({
      type: KB_FILE_DND,
      item: { id: fileId, folder_id: folderId },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [fileId, folderId],
  );

  return (
    <li>
      <button
        ref={dragRef as unknown as React.Ref<HTMLButtonElement>}
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-[3px] py-1 pr-2 text-left transition-colors",
          selected
            ? "bg-data-accent/15 text-data-accent"
            : "text-primary-text hover:bg-background-hover",
          isDragging && "opacity-40",
        )}
        style={{ paddingLeft: `${8 + level * 12 + 18}px` }}
      >
        {FILE_ICONS[file.type] ?? <FileIcon className="h-3.5 w-3.5" />}
        <span className="ty-body-2 truncate">{file.name}</span>
      </button>
    </li>
  );
}
