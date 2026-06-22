"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { EditorToolbar } from "@/components/kb/editor-toolbar";

interface MarkdownEditorProps {
  fileId: string;
  initialContent: string;
  onChange: (html: string) => void;
  /**
   * Milliseconds of idle keystrokes before `onChange` fires. Defaults to 0
   * (synchronous) — the KB flow stashes edits into a local dirty buffer
   * and only hits the network on an explicit Commit click, so coalescing
   * keystrokes here would just delay UI updates.
   */
  debounceMs?: number;
  /**
   * When true, the editor sizes to its own content (no internal scroll) and
   * the toolbar is sticky to the top of whatever scroll container the editor
   * is embedded in. Used by the issue modal where the body + comment thread
   * share one scroller.
   */
  embedded?: boolean;
  /** Document title shown at the right end of the toolbar (non-embedded). */
  title?: string;
  /** Click-to-edit rename; called with the new name on commit. */
  onRenameTitle?: (name: string) => void;
}

export function MarkdownEditor({
  fileId,
  initialContent,
  onChange,
  debounceMs = 0,
  embedded = false,
  title,
  onRenameTitle,
}: MarkdownEditorProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
        // StarterKit now bundles Link; we configure our own below for
        // openOnClick + rel/target. Disable the built-in to avoid the
        // duplicate-extension warning Tiptap logs at editor init.
        link: false,
      }),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const html = editor.getHTML();
      if (debounceMs <= 0) {
        onChangeRef.current(html);
        return;
      }
      timerRef.current = setTimeout(() => {
        onChangeRef.current(html);
      }, debounceMs);
    },
    immediatelyRender: false,
  });

  // Flush any pending save when the file changes or the editor unmounts.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [fileId]);

  // Swap content when the user switches files
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== initialContent) {
      editor.commands.setContent(initialContent || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, editor]);

  if (!editor) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="ty-caption text-tertiary-text">Loading editor…</p>
      </div>
    );
  }

  if (embedded) {
    return (
      <div className="flex flex-col">
        <div className="sticky top-0 z-10 bg-[#141414]">
          <EditorToolbar editor={editor} />
        </div>
        <div className="mx-auto w-full max-w-[760px] px-8 py-6">
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border pr-3">
        <div className="min-w-0 flex-1">
          <EditorToolbar editor={editor} />
        </div>
        {title !== undefined && onRenameTitle && (
          <EditableTitle value={title} onCommit={onRenameTitle} />
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-12 py-10">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

/** Click-to-edit document title shown at the right of the editor toolbar. */
function EditableTitle({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value);
            setEditing(false);
          }
        }}
        className="ty-body-2 w-52 shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-right text-primary-text outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      title="Click to rename"
      className="ty-body-2 max-w-[260px] shrink-0 truncate rounded px-1.5 py-0.5 font-medium text-primary-text hover:bg-background-subtle"
    >
      {value}
    </button>
  );
}
