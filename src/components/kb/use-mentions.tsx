"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import { findMentionCandidates } from "@/lib/files/graph-actions";
import type { MentionCandidate } from "@/lib/kb/types";
import { MentionPopup, type MentionMode } from "@/components/kb/mention-popup";

interface MentionState {
  mode: MentionMode;
  query: string;
  /** Doc range the inserted mention replaces (footnote: from === to). */
  from: number;
  to: number;
  items: MentionCandidate[];
  index: number;
  coords: { left: number; top: number; bottom: number };
}

interface UseMentionsOptions {
  /** The doc being edited — excluded from results (no self-citation). */
  fileId: string;
  /** Scope the picker to a project folder when set. */
  folderId?: string;
}

const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", "Escape"]);
// Matches a trailing "@query" the user is typing (start of block or after space).
const TRIGGER = /(?:^|\s)@([\w-]{0,40})$/;

/**
 * Self-contained @-mention / footnote citation picker for the TipTap editor.
 * Inline mode triggers on typing "@" and reads its query from the document;
 * footnote mode is opened from the toolbar and carries its own search input.
 * Selecting a document inserts a `bridgeMention` node; the bridge row itself is
 * persisted on save by `syncBridgesFromContent`.
 */
export function useMentions({ fileId, folderId }: UseMentionsOptions) {
  const [state, setState] = useState<MentionState | null>(null);
  const stateRef = useRef<MentionState | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  const update = useCallback((next: MentionState | null) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const close = useCallback(() => update(null), [update]);

  const runSearch = useCallback(
    (query: string) => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      const seq = ++searchSeq.current;
      searchTimer.current = setTimeout(async () => {
        try {
          const items = await findMentionCandidates(query, folderId, fileId);
          // Ignore stale responses and writes after the picker closed.
          if (seq !== searchSeq.current || !stateRef.current) return;
          update({ ...stateRef.current, items, index: 0 });
        } catch (error) {
          console.error("mention search failed", error);
        }
      }, 120);
    },
    [fileId, folderId, update]
  );

  const insert = useCallback(
    (item: MentionCandidate) => {
      const editor = editorRef.current;
      const current = stateRef.current;
      if (!editor || !current) return;
      const anchor =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${item.id}-${Date.now()}`;
      const content = [
        {
          type: "bridgeMention",
          attrs: {
            fileId: item.id,
            label: item.name,
            kind: current.mode === "footnote" ? "footnote" : "cite",
            anchor,
          },
        },
        ...(current.mode === "inline"
          ? [{ type: "text", text: " " }]
          : []),
      ];
      editor
        .chain()
        .focus()
        .insertContentAt({ from: current.from, to: current.to }, content)
        .run();
      close();
    },
    [close]
  );

  // Move the active row / pick / dismiss. Shared by both modes.
  const navigate = useCallback(
    (key: "ArrowDown" | "ArrowUp" | "Enter" | "Escape"): boolean => {
      const current = stateRef.current;
      if (!current) return false;
      if (key === "Escape") {
        close();
        editorRef.current?.commands.focus();
        return true;
      }
      const len = current.items.length;
      if (key === "Enter") {
        if (len > 0) insert(current.items[current.index]);
        else close();
        return true;
      }
      if (len === 0) return true;
      const index =
        key === "ArrowDown"
          ? (current.index + 1) % len
          : (current.index - 1 + len) % len;
      update({ ...current, index });
      return true;
    },
    [close, insert, update]
  );

  /** Inline detection — run from the editor's update + selection callbacks. */
  const handleUpdate = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      // Footnote mode is driven by its own input, not the document text.
      if (stateRef.current?.mode === "footnote") return;

      const { selection } = editor.state;
      if (!selection.empty) {
        if (stateRef.current) close();
        return;
      }
      const cursor = selection.from;
      const blockStart = selection.$from.start();
      const before = editor.state.doc.textBetween(blockStart, cursor, "\n", "\0");
      const match = TRIGGER.exec(before);
      if (!match) {
        if (stateRef.current) close();
        return;
      }
      const query = match[1];
      const from = cursor - query.length - 1; // include the "@"
      const c = editor.view.coordsAtPos(cursor);
      const coords = { left: c.left, top: c.top, bottom: c.bottom };
      const existed = stateRef.current?.mode === "inline";
      update({
        mode: "inline",
        query,
        from,
        to: cursor,
        items: existed ? (stateRef.current?.items ?? []) : [],
        index: 0,
        coords,
      });
      runSearch(query);
    },
    [close, runSearch, update]
  );

  /** Editor keydown hook — consume nav keys only while the inline picker is open. */
  const handleKeyDown = useCallback(
    (_view: EditorView, event: KeyboardEvent): boolean => {
      const current = stateRef.current;
      if (!current || current.mode !== "inline") return false;
      if (!NAV_KEYS.has(event.key)) return false;
      return navigate(event.key as "ArrowDown" | "ArrowUp" | "Enter" | "Escape");
    },
    [navigate]
  );

  /** Open the footnote picker at the cursor (called from the toolbar). */
  const triggerFootnote = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      const cursor = editor.state.selection.from;
      const c = editor.view.coordsAtPos(cursor);
      update({
        mode: "footnote",
        query: "",
        from: cursor,
        to: cursor,
        items: [],
        index: 0,
        coords: { left: c.left, top: c.top, bottom: c.bottom },
      });
      runSearch("");
    },
    [runSearch, update]
  );

  const setQuery = useCallback(
    (query: string) => {
      if (!stateRef.current) return;
      update({ ...stateRef.current, query });
      runSearch(query);
    },
    [runSearch, update]
  );

  // Dismiss on outside click.
  useEffect(() => {
    if (!state) return;
    function onDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-mention-popup]")) return;
      if (stateRef.current?.mode === "inline") return; // editor click handled by detection
      close();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [state, close]);

  const popup = state ? (
    <div data-mention-popup>
      <MentionPopup
        items={state.items}
        activeIndex={state.index}
        mode={state.mode}
        query={state.query}
        coords={state.coords}
        onHover={(index) =>
          stateRef.current && update({ ...stateRef.current, index })
        }
        onSelect={insert}
        onQueryChange={setQuery}
        onKeyNav={navigate}
      />
    </div>
  ) : null;

  return { handleUpdate, handleKeyDown, triggerFootnote, popup };
}
