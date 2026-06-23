"use client";

import { useEffect, useRef } from "react";
import {
  FileTextIcon,
  FileIcon,
  ImageIcon,
  TableIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { KBFileType, MentionCandidate } from "@/lib/kb/types";

export type MentionMode = "inline" | "footnote";

interface MentionPopupProps {
  items: MentionCandidate[];
  activeIndex: number;
  mode: MentionMode;
  /** Filter text shown in footnote mode (inline mode reads from the doc). */
  query: string;
  coords: { left: number; top: number; bottom: number };
  onHover: (index: number) => void;
  onSelect: (item: MentionCandidate) => void;
  onQueryChange: (value: string) => void;
  onKeyNav: (key: "ArrowDown" | "ArrowUp" | "Enter" | "Escape") => void;
}

const ICONS: Record<string, LucideIcon> = {
  md: FileTextIcon,
  note: FileTextIcon,
  doc: FileTextIcon,
  pdf: FileIcon,
  image: ImageIcon,
  las: TableIcon,
};

function iconFor(type: KBFileType): LucideIcon {
  return ICONS[type] ?? FileIcon;
}

/**
 * The document picker shown when citing. In inline mode it floats under the
 * caret and the query comes from the "@…" text in the doc (keyboard handled by
 * the editor). In footnote mode it carries its own search input.
 */
export function MentionPopup({
  items,
  activeIndex,
  mode,
  query,
  coords,
  onHover,
  onSelect,
  onQueryChange,
  onKeyNav,
}: MentionPopupProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (mode === "footnote") inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div
      className="fixed z-50 w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
      style={{ left: coords.left, top: coords.bottom + 4 }}
      // Don't steal focus from the editor on click in inline mode.
      onMouseDown={(e) => mode === "inline" && e.preventDefault()}
    >
      {mode === "footnote" && (
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "ArrowDown" ||
              e.key === "ArrowUp" ||
              e.key === "Enter" ||
              e.key === "Escape"
            ) {
              e.preventDefault();
              onKeyNav(e.key);
            }
          }}
          placeholder="Search documents to cite…"
          className="w-full border-b border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
      )}

      <ul className="max-h-64 overflow-y-auto py-1">
        {items.length === 0 ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">
            No matching documents
          </li>
        ) : (
          items.map((item, i) => {
            const Icon = iconFor(item.type);
            return (
              <li key={item.id}>
                <button
                  ref={i === activeIndex ? activeRef : undefined}
                  type="button"
                  onMouseEnter={() => onHover(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(item);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                    i === activeIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.name}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
