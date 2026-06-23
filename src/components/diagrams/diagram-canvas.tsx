"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Tldraw, type Editor } from "tldraw";
import "tldraw/tldraw.css";
import { Button } from "@/components/ui/button";
import { DiagramCitations } from "@/components/diagrams/diagram-citations";
import { getDiagram, saveDiagram } from "@/lib/diagrams/actions";
import { renameFile } from "@/lib/files/actions";
import { graphFromEditor, materializeSpec } from "@/lib/diagrams/layout";
import { isPendingDiagram } from "@/lib/diagrams/types";

interface DiagramCanvasProps {
  fileId: string;
  name: string;
  /** Back to the folder listing (Files page). Omitted in the project panel. */
  onBack?: () => void;
}

/** Strip the trailing extension for a human title. */
function titleFromName(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "");
}

/**
 * The diagram editor surface. Loads the file's tldraw content, materializes an
 * Archon-authored spec on first open, and autosaves the snapshot + the semantic
 * graph (so Archon can read the canvas) on every edit. Mounted client-side only
 * (tldraw needs the DOM); callers load it via next/dynamic with ssr:false.
 */
export function DiagramCanvas({ fileId, name, onBack }: DiagramCanvasProps) {
  const router = useRouter();
  const editorRef = useRef<Editor | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlisten = useRef<(() => void) | null>(null);
  // The loaded canvas content, ready for handleMount. null until fetched.
  const contentRef = useRef<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    getDiagram(fileId)
      .then((d) => {
        if (!active) return;
        contentRef.current = d?.content ?? "";
        setLoaded(true);
      })
      .catch((error) => {
        console.error("Failed to load diagram", error);
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [fileId]);

  const save = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    // Stringify the snapshot client-side: the raw tldraw object isn't
    // serializable across the Server Action boundary (opaque references).
    const snapshotJson = JSON.stringify(editor.getSnapshot());
    const graph = graphFromEditor(editor, titleFromName(name));
    saveDiagram(fileId, snapshotJson, graph).catch((error) =>
      console.error("Failed to save diagram", error)
    );
  }, [fileId, name]);

  const queueSave = useCallback(
    (delay: number) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(save, delay);
    },
    [save]
  );

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      const raw = contentRef.current?.trim();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (isPendingDiagram(parsed)) {
            materializeSpec(editor, parsed.pending);
            editor.zoomToFit();
            // Persist the materialized shapes so the next open loads a snapshot.
            queueSave(0);
          } else {
            editor.loadSnapshot(parsed);
          }
        } catch (error) {
          console.error("Failed to parse diagram content", error);
        }
      }
      // Listen after the initial load so our own load doesn't trigger a save.
      unlisten.current = editor.store.listen(() => queueSave(800), {
        source: "user",
        scope: "document",
      });
    },
    [queueSave]
  );

  // Flush a pending save and detach the listener on unmount.
  useEffect(() => {
    return () => {
      unlisten.current?.();
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        save();
      }
    };
  }, [save]);

  function handleBack() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    save();
    onBack?.();
  }

  async function commitTitle(next: string) {
    const trimmed = next.trim();
    if (!trimmed || trimmed === titleFromName(name)) return;
    const withExt = /\.[a-z0-9]+$/i.test(trimmed)
      ? trimmed
      : `${trimmed}.diagram`;
    try {
      await renameFile(fileId, withExt);
      router.refresh();
    } catch (error) {
      console.error("Failed to rename diagram", error);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Back"
            onClick={handleBack}
          >
            <ArrowLeftIcon />
          </Button>
        )}
        <input
          defaultValue={titleFromName(name)}
          onBlur={(e) => commitTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Diagram title"
          className="min-w-0 flex-1 rounded px-1 font-heading text-2xl font-semibold tracking-tight outline-none focus:bg-muted/40"
        />
        <DiagramCitations fileId={fileId} />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        {loaded ? (
          <Tldraw onMount={handleMount} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        )}
      </div>
    </div>
  );
}
