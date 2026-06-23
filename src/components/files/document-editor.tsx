"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownEditor } from "@/components/projects/markdown-editor";
import { getDoc, renameFile, saveDoc } from "@/lib/files/actions";
import type { RepoFile } from "@/lib/kb/types";

type SaveStatus = "idle" | "saving" | "saved";

/**
 * Editable document surface for inline docs (markdown / notes). The body uses
 * the same rich-text editor as projects (TipTap toolbar at the top
 * + editable content) and autosaves (debounced); the title saves on commit.
 */
export function DocumentEditor({
  file,
  onBack,
}: {
  file: RepoFile;
  onBack: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(file.name);
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors the latest body so we can flush a pending save on exit/unmount
  // without threading it through the debounce closure.
  const contentRef = useRef("");

  useEffect(() => {
    let active = true;
    getDoc(file.id)
      .then((doc) => {
        if (!active) return;
        if (doc) {
          setContent(doc.content);
          contentRef.current = doc.content;
          setName(doc.name);
        }
        setLoaded(true);
      })
      .catch((error) => {
        console.error("Failed to load document", error);
        setLoaded(true);
      });
    return () => {
      active = false;
      // Flush any pending edit for the doc we're leaving.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        saveDoc(file.id, contentRef.current).catch((error) =>
          console.error("Failed to save document", error)
        );
      }
    };
  }, [file.id]);

  function persist(next: string) {
    setStatus("saving");
    saveDoc(file.id, next)
      .then(() => setStatus("saved"))
      .catch((error) => {
        console.error("Failed to save document", error);
        setStatus("idle");
      });
  }

  function handleContentChange(html: string) {
    contentRef.current = html;
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(html), 700);
  }

  function handleBack() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      persist(contentRef.current);
    }
    onBack();
  }

  async function commitTitle() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === file.name) {
      if (!trimmed) setName(file.name);
      return;
    }
    try {
      await renameFile(file.id, trimmed);
      router.refresh();
    } catch (error) {
      console.error("Failed to rename document", error);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Back"
          onClick={handleBack}
        >
          <ArrowLeftIcon />
        </Button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Document title"
          className="min-w-0 flex-1 rounded px-1 font-heading text-2xl font-semibold tracking-tight outline-none focus:bg-muted/40"
        />
        <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background">
        {loaded ? (
          <MarkdownEditor
            key={file.id}
            fileId={file.id}
            initialContent={content}
            onChange={handleContentChange}
            folderId={file.folder_id !== "root" ? file.folder_id : undefined}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        )}
      </div>
    </div>
  );
}
